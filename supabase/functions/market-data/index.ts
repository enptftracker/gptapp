import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const alphaVantageKey = Deno.env.get('ALPHAVANTAGE_API_KEY') ?? '';

const adminClient = createClient(supabaseUrl, serviceRoleKey);

interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: string;
}

type MarketProvider = 'alphavantage' | 'yahoo';

type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

interface HistoricalPoint {
  time: string;
  price: number;
}

const MAX_HISTORICAL_POINTS = 3652;

const HISTORICAL_RANGE_LIMIT: Record<HistoricalRange, number | null> = {
  '1D': 1,
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 372,
  '5Y': 1860,
  'MAX': null
};

const YAHOO_RANGE_CONFIG: Record<HistoricalRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '15m' },
  '1W': { range: '5d', interval: '1h' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '5Y': { range: '5y', interval: '1mo' },
  'MAX': { range: 'max', interval: '3mo' }
};

interface DailyPoint {
  date: string;
  price: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

const withCors = (response: Response, corsHeaders: HeadersInit) => {
  const headers = new Headers(response.headers);
  const cors = new Headers(corsHeaders);
  cors.forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

function normalizeProvider(input: unknown): MarketProvider | null {
  if (typeof input !== 'string') {
    return null;
  }

  if (input.toLowerCase() === 'alphavantage') {
    return 'alphavantage';
  }

  if (input.toLowerCase() === 'yahoo' || input.toLowerCase() === 'yfinance') {
    return 'yahoo';
  }

  return null;
}

async function fetchAlphaVantageQuote(symbol: string): Promise<MarketQuote> {
  if (!alphaVantageKey) {
    throw new Error('Alpha Vantage API key is not configured.');
  }

  const response = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${alphaVantageKey}`
  );

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with status ${response.status}.`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const quote = (payload['Global Quote'] ?? {}) as Record<string, string>;

  if (payload['Note']) {
    throw new Error(String(payload['Note']));
  }

  if (!quote['05. price']) {
    throw new Error('Alpha Vantage returned no data.');
  }

  const price = Number.parseFloat(quote['05. price']);
  const change = Number.parseFloat(quote['09. change'] ?? '0');
  const changePercent = Number.parseFloat((quote['10. change percent'] ?? '0').replace('%', ''));
  const volume = Number.parseInt(quote['06. volume'] ?? '0', 10);

  if (!Number.isFinite(price)) {
    throw new Error('Alpha Vantage returned an invalid price.');
  }

  return {
    symbol,
    price,
    change: Number.isFinite(change) ? change : 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    volume: Number.isFinite(volume) ? volume : undefined,
    lastUpdated: new Date().toISOString()
  };
}

async function fetchYahooQuote(symbol: string): Promise<MarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;

  if (!result || !meta) {
    throw new Error('Yahoo Finance returned no data.');
  }

  const currentPrice = Number(meta.regularMarketPrice ?? meta.previousClose);
  const previousClose = Number(meta.previousClose ?? currentPrice);

  if (!Number.isFinite(currentPrice)) {
    throw new Error('Yahoo Finance returned an invalid price.');
  }

  const change = Number.isFinite(previousClose) ? currentPrice - previousClose : 0;
  const changePercent = Number.isFinite(previousClose) && previousClose !== 0
    ? (change / previousClose) * 100
    : 0;

  return {
    symbol,
    price: Number.parseFloat(currentPrice.toFixed(4)),
    change: Number.parseFloat(change.toFixed(4)),
    changePercent: Number.parseFloat(changePercent.toFixed(4)),
    volume: typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : undefined,
    marketCap: typeof meta.marketCap === 'number' ? meta.marketCap : undefined,
    lastUpdated: new Date().toISOString()
  };
}

async function fetchQuoteWithFallback(symbol: string, preferred?: MarketProvider) {
  const order: MarketProvider[] = preferred === 'yahoo'
    ? ['yahoo', 'alphavantage']
    : ['alphavantage', 'yahoo'];

  const errors: Error[] = [];

  for (const provider of order) {
    try {
      const quote = provider === 'alphavantage'
        ? await fetchAlphaVantageQuote(symbol)
        : await fetchYahooQuote(symbol);

      return { quote, provider } as const;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const summary = errors.map(error => error.message).join(' | ');
  throw new Error(summary || 'All quote providers failed.');
}

async function fetchAlphaVantageDailySeries(symbol: string): Promise<DailyPoint[]> {
  if (!alphaVantageKey) {
    throw new Error('Alpha Vantage API key is not configured.');
  }

  const response = await fetch(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${alphaVantageKey}`
  );

  if (!response.ok) {
    throw new Error(`Alpha Vantage historical request failed with status ${response.status}.`);
  }

  const payload = await response.json() as Record<string, unknown>;

  if (payload['Note']) {
    throw new Error(String(payload['Note']));
  }

  const series = payload['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;

  if (!series) {
    throw new Error('Alpha Vantage returned no historical data.');
  }

  const points: DailyPoint[] = Object.entries(series)
    .map(([date, values]) => {
      const price = Number.parseFloat(values['4. close']);
      if (!Number.isFinite(price)) {
        return null;
      }

      return {
        date,
        price: Number.parseFloat(price.toFixed(4))
      };
    })
    .filter((entry): entry is DailyPoint => Boolean(entry))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!points.length) {
    throw new Error('Alpha Vantage returned no usable historical data.');
  }

  return points;
}

async function fetchYahooHistoricalRange(symbol: string, range: HistoricalRange): Promise<HistoricalPoint[]> {
  const config = YAHOO_RANGE_CONFIG[range];
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`
  );

  if (!response.ok) {
    throw new Error(`Yahoo Finance historical request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];

  if (!result) {
    throw new Error('Yahoo Finance returned no historical data.');
  }

  const timestamps: Array<number | null> | undefined = result.timestamp;
  const quoteSeries: Array<number | null> | undefined = result.indicators?.quote?.[0]?.close;
  const adjCloseSeries: Array<number | null> | undefined = result.indicators?.adjclose?.[0]?.adjclose;

  const series = quoteSeries && quoteSeries.some(value => typeof value === 'number')
    ? quoteSeries
    : adjCloseSeries;

  if (!Array.isArray(timestamps) || !Array.isArray(series)) {
    throw new Error('Yahoo Finance returned incomplete historical data.');
  }

  const points: HistoricalPoint[] = [];

  timestamps.forEach((timestamp, index) => {
    if (typeof timestamp !== 'number') {
      return;
    }

    const price = series[index];
    if (typeof price !== 'number' || Number.isNaN(price)) {
      return;
    }

    points.push({
      time: new Date(timestamp * 1000).toISOString(),
      price: Number.parseFloat(price.toFixed(4))
    });
  });

  if (!points.length) {
    throw new Error('Yahoo Finance returned no usable historical data.');
  }

  return points;
}

function mapDailySeriesToRange(series: DailyPoint[], range: HistoricalRange): HistoricalPoint[] {
  const limit = HISTORICAL_RANGE_LIMIT[range];
  const trimmed = limit ? series.slice(-limit) : series;

  return trimmed.map(point => ({
    time: `${point.date}T00:00:00Z`,
    price: point.price
  }));
}

async function fetchHistoricalRange(symbol: string, range: HistoricalRange, preferred?: MarketProvider) {
  const order: MarketProvider[] = preferred === 'yahoo'
    ? ['yahoo', 'alphavantage']
    : ['alphavantage', 'yahoo'];

  const errors: Error[] = [];

  for (const provider of order) {
    try {
      if (provider === 'alphavantage') {
        const daily = await fetchAlphaVantageDailySeries(symbol);
        const points = mapDailySeriesToRange(daily, range);
        if (!points.length) {
          throw new Error('Alpha Vantage returned no data for requested range.');
        }

        return { symbol, range, points: points.slice(-800), currency: 'USD', provider } as const;
      }

      const points = await fetchYahooHistoricalRange(symbol, range);
      return { symbol, range, points: points.slice(-800), currency: 'USD', provider } as const;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  const summary = errors.map(error => error.message).join(' | ');
  throw new Error(summary || 'All historical providers failed.');
}

async function upsertQuoteCache(symbolId: string, quote: MarketQuote) {
  const { error } = await adminClient
    .from('price_cache')
    .upsert({
      symbol_id: symbolId,
      price: quote.price,
      price_currency: 'USD',
      change_24h: quote.change,
      change_percent_24h: quote.changePercent,
      asof: new Date().toISOString()
    }, { onConflict: 'symbol_id' });

  if (error) {
    throw error;
  }
}

async function refreshHistoricalSeries(symbol: string, client: SupabaseClient, preferred?: MarketProvider) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const { data: symbolRecord, error: symbolError } = await client
    .from('symbols')
    .select('id')
    .eq('ticker', normalizedSymbol)
    .maybeSingle();

  if (symbolError) {
    throw symbolError;
  }

  if (!symbolRecord) {
    throw new Error(`Symbol ${normalizedSymbol} not found in database.`);
  }

  const order: MarketProvider[] = preferred === 'yahoo'
    ? ['yahoo', 'alphavantage']
    : ['alphavantage', 'yahoo'];

  let points: DailyPoint[] | null = null;
  let provider: MarketProvider | null = null;
  const errors: Error[] = [];

  for (const candidate of order) {
    try {
      if (candidate === 'alphavantage') {
        points = await fetchAlphaVantageDailySeries(normalizedSymbol);
      } else {
        const yahooPoints = await fetchYahooHistoricalRange(normalizedSymbol, 'MAX');
        points = yahooPoints.map(point => ({
          date: point.time.slice(0, 10),
          price: point.price
        }));
      }

      provider = candidate;
      break;
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (!points || !provider) {
    const summary = errors.map(error => error.message).join(' | ');
    throw new Error(summary || `Unable to refresh historical series for ${normalizedSymbol}.`);
  }

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

  const filtered = points
    .filter(entry => new Date(`${entry.date}T00:00:00Z`) >= tenYearsAgo)
    .slice(-MAX_HISTORICAL_POINTS);

  const batches: DailyPoint[][] = [];
  const batchSize = 200;

  for (let index = 0; index < filtered.length; index += batchSize) {
    batches.push(filtered.slice(index, index + batchSize));
  }

  for (const batch of batches) {
    const payload = batch.map(point => ({
      symbol_id: symbolRecord.id,
      date: point.date,
      price: point.price,
      price_currency: 'USD'
    }));

    const { error } = await client
      .from('historical_price_cache')
      .upsert(payload, { onConflict: 'symbol_id,date' });

    if (error) {
      throw error;
    }
  }

  return { count: filtered.length, provider } as const;
}

type MarketDataRequest =
  | { action: 'status' }
  | { action: 'quote'; symbol: string; provider?: string }
  | { action: 'batch_update'; symbols: Array<{ id: string; ticker: string }>; provider?: string }
  | { action: 'historical_range'; symbol: string; range: HistoricalRange; provider?: string }
  | { action: 'historical'; symbols?: string[]; provider?: string };

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 200 }), corsHeaders);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Supabase environment variables are not fully configured.');
      return withCors(jsonResponse({ error: 'Server configuration error.' }, { status: 500 }), corsHeaders);
    }

    const authHeader = req.headers.get('Authorization')?.trim() ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return withCors(jsonResponse({ error: 'Unauthorized' }, { status: 401 }), corsHeaders);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return withCors(jsonResponse({ error: 'Unauthorized' }, { status: 401 }), corsHeaders);
    }

    let payload: MarketDataRequest;
    try {
      payload = await req.json();
    } catch (error) {
      console.error('Invalid request payload:', error);
      return withCors(jsonResponse({ error: 'Invalid JSON body.' }, { status: 400 }), corsHeaders);
    }

    const preferredProvider = normalizeProvider('provider' in payload ? payload.provider : undefined) ?? undefined;

    switch (payload.action) {
      case 'status': {
        return withCors(jsonResponse({
          alphaConfigured: Boolean(alphaVantageKey),
          serviceRoleConfigured: Boolean(serviceRoleKey),
          anonKeyConfigured: Boolean(anonKey)
        }), corsHeaders);
      }

      case 'quote': {
        const symbol = payload.symbol?.trim().toUpperCase();
        if (!symbol) {
          return withCors(jsonResponse({ error: 'Symbol is required.' }, { status: 400 }), corsHeaders);
        }

        try {
          const { quote, provider } = await fetchQuoteWithFallback(symbol, preferredProvider);

          const { data: symbolRecord } = await adminClient
            .from('symbols')
            .select('id')
            .eq('ticker', symbol)
            .maybeSingle();

          if (symbolRecord?.id) {
            try {
              await upsertQuoteCache(symbolRecord.id, quote);
            } catch (error) {
              console.error(`Failed to persist quote for ${symbol}:`, error);
            }
          }

          return withCors(jsonResponse({ ...quote, source: provider }), corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch quote.';
          console.error(`Quote request failed for ${symbol}:`, message);
          return withCors(jsonResponse({ error: message }, { status: 502 }), corsHeaders);
        }
      }

      case 'batch_update': {
        if (!Array.isArray(payload.symbols) || payload.symbols.length === 0) {
          return withCors(jsonResponse({ error: 'symbols must be a non-empty array.' }, { status: 400 }), corsHeaders);
        }

        if (payload.symbols.length > 20) {
          return withCors(jsonResponse({ error: 'Too many symbols requested.' }, { status: 400 }), corsHeaders);
        }

        const results: Array<{ symbol: string; success: boolean; error?: string; source?: MarketProvider }> = [];

        for (let index = 0; index < payload.symbols.length; index++) {
          const entry = payload.symbols[index];
          const symbol = entry?.ticker?.trim().toUpperCase();
          const id = entry?.id;

          if (!symbol || !id) {
            results.push({ symbol: entry?.ticker ?? 'UNKNOWN', success: false, error: 'Invalid symbol payload.' });
            continue;
          }

          try {
            const { quote, provider } = await fetchQuoteWithFallback(symbol, preferredProvider);
            await upsertQuoteCache(id, quote);
            results.push({ symbol, success: true, source: provider });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch quote.';
            console.error(`Batch quote failed for ${symbol}:`, message);
            results.push({ symbol, success: false, error: message });
          }

          if (index < payload.symbols.length - 1) {
            await sleep(12_000);
          }
        }

        return withCors(jsonResponse({ results }), corsHeaders);
      }

      case 'historical_range': {
        const symbol = payload.symbol?.trim().toUpperCase();
        const range = payload.range;

        if (!symbol) {
          return withCors(jsonResponse({ error: 'Symbol is required.' }, { status: 400 }), corsHeaders);
        }

        if (!range || !Object.prototype.hasOwnProperty.call(YAHOO_RANGE_CONFIG, range)) {
          return withCors(jsonResponse({ error: 'Unsupported range.' }, { status: 400 }), corsHeaders);
        }

        try {
          const result = await fetchHistoricalRange(symbol, range, preferredProvider);
          return withCors(jsonResponse({ ...result }), corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch historical data.';
          console.error(`Historical range request failed for ${symbol}:`, message);
          return withCors(jsonResponse({ error: message }, { status: 502 }), corsHeaders);
        }
      }

      case 'historical': {
        const symbols = Array.isArray(payload.symbols) && payload.symbols.length
          ? Array.from(new Set(payload.symbols.map(symbol => symbol?.trim().toUpperCase()).filter(Boolean)))
          : ['SPY', 'QQQ', 'IWM'];

        const results: Array<{ symbol: string; success: boolean; count?: number; source?: MarketProvider; error?: string }> = [];

        for (let index = 0; index < symbols.length; index++) {
          const symbol = symbols[index];

          try {
            const summary = await refreshHistoricalSeries(symbol, adminClient, preferredProvider);
            results.push({ symbol, success: true, count: summary.count, source: summary.provider });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to refresh historical data.';
            console.error(`Historical refresh failed for ${symbol}:`, message);
            results.push({ symbol, success: false, error: message });
          }

          if (index < symbols.length - 1) {
            await sleep(12_000);
          }
        }

        const success = results.every(result => result.success);
        return withCors(jsonResponse({ success, results }), corsHeaders);
      }

      default: {
        return withCors(jsonResponse({ error: 'Invalid action.' }, { status: 400 }), corsHeaders);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    console.error('Market data function error:', message);
    return withCors(jsonResponse({ error: message }, { status: 500 }), corsHeaders);
  }
});
