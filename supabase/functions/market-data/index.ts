import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const adminClient = createClient(supabaseUrl, serviceRoleKey);

interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: string;
}

interface HistoricalPoint {
  time: string;
  price: number;
}

interface PriceUpdateErrorDetail {
  ticker: string;
  message: string;
}

interface PriceUpdateSummary {
  provider: 'yahoo';
  totalSymbols: number;
  updated: number;
  failed: number;
  errors: PriceUpdateErrorDetail[];
  startedAt: string;
  completedAt: string;
}

type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

const YAHOO_RANGE_CONFIG: Record<HistoricalRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
  'MAX': { range: 'max', interval: '1mo' }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldThrottleProvider = (provider: MarketProvider | null | undefined) => provider === 'alphavantage';

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

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

async function fetchYahooQuote(symbol: string): Promise<LiveQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SupabaseEdge/1.0)' }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed (${response.status}).`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;

  if (!result || !meta) {
    throw new Error('Yahoo Finance returned no data.');
  }

  const regularPrice = toNumber(meta.regularMarketPrice ?? meta.chartPreviousClose ?? meta.previousClose);
  const previousClose = toNumber(meta.previousClose ?? meta.chartPreviousClose ?? regularPrice);

  if (typeof regularPrice !== 'number') {
    throw new Error('Yahoo Finance returned an invalid price.');
  }

  const rawChange = typeof previousClose === 'number' ? regularPrice - previousClose : 0;
  const rawChangePercent = typeof previousClose === 'number' && previousClose !== 0
    ? (rawChange / previousClose) * 100
    : 0;

  const volumeSeries = Array.isArray(result?.indicators?.quote?.[0]?.volume)
    ? result.indicators.quote[0].volume
    : undefined;
  const latestVolume = Array.isArray(volumeSeries)
    ? volumeSeries.reverse().find(value => typeof value === 'number')
    : toNumber(meta.regularMarketVolume);

  const marketCap = toNumber(meta.marketCap);

  return {
    symbol,
    price: Number.parseFloat(regularPrice.toFixed(4)),
    change: Number.parseFloat(rawChange.toFixed(4)),
    changePercent: Number.parseFloat(rawChangePercent.toFixed(4)),
    volume: typeof latestVolume === 'number' ? latestVolume : undefined,
    marketCap: typeof marketCap === 'number' ? marketCap : undefined,
    lastUpdated: new Date().toISOString()
  };
}

async function fetchYahooHistorical(symbol: string, range: HistoricalRange): Promise<HistoricalPoint[]> {
  const config = YAHOO_RANGE_CONFIG[range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SupabaseEdge/1.0)' }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance historical request failed (${response.status}).`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];

  if (!result) {
    throw new Error('Yahoo Finance returned no historical data.');
  }

  const timestamps: Array<number | null> | undefined = result.timestamp;
  const quoteSeries: Array<number | null> | undefined = result.indicators?.quote?.[0]?.close;
  const adjSeries: Array<number | null> | undefined = result.indicators?.adjclose?.[0]?.adjclose;

  const series = Array.isArray(quoteSeries) && quoteSeries.some(value => typeof value === 'number')
    ? quoteSeries
    : adjSeries;

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

  return points;
}

async function persistQuote(symbolId: string, quote: LiveQuote) {
  const { error } = await adminClient
    .from('price_cache')
    .upsert({
      symbol_id: symbolId,
      price: quote.price,
      price_currency: 'USD',
      change_24h: quote.change,
      change_percent_24h: quote.changePercent,
      asof: quote.lastUpdated
    }, { onConflict: 'symbol_id' });

  if (error) {
    throw error;
  }
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')?.trim() ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user.id;
}

function normalizeTickers(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(entry => {
      if (typeof entry === 'string') {
        return entry.trim().toUpperCase();
      }

      if (entry && typeof entry === 'object' && 'ticker' in entry && typeof (entry as { ticker?: unknown }).ticker === 'string') {
        return ((entry as { ticker: string }).ticker).trim().toUpperCase();
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
}

async function loadSymbolsForUser(userId: string, tickers: string[]): Promise<Array<{ id: string; ticker: string }>> {
  let query = adminClient
    .from('symbols')
    .select('id, ticker')
    .eq('owner_id', userId)
    .order('ticker');

  if (tickers.length) {
    query = query.in('ticker', tickers);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadPortfolioSymbols(
  userId: string,
  portfolioId: string
): Promise<Array<{ id: string; ticker: string }>> {
  const { data: transactionSymbols, error: transactionError } = await adminClient
    .from('transactions')
    .select('symbol_id')
    .eq('owner_id', userId)
    .eq('portfolio_id', portfolioId)
    .not('symbol_id', 'is', null);

  if (transactionError) {
    throw transactionError;
  }

  const entries = (transactionSymbols ?? []) as Array<{ symbol_id: string | null }>;

  const symbolIds = Array.from(
    new Set(
      entries
        .map(entry => entry.symbol_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  if (!symbolIds.length) {
    return [];
  }

  const { data: symbols, error: symbolError } = await adminClient
    .from('symbols')
    .select('id, ticker')
    .in('id', symbolIds)
    .order('ticker');

  if (symbolError) {
    throw symbolError;
  }

  return (symbols ?? []).filter(
    (symbol): symbol is { id: string; ticker: string } =>
      typeof symbol?.id === 'string' &&
      symbol.id.length > 0 &&
      typeof symbol?.ticker === 'string' &&
      symbol.ticker.length > 0
  );
}

type MarketDataRequest =
  | { action: 'quote'; symbol: string }
  | { action: 'refresh_prices'; symbols?: unknown }
  | { action: 'historical'; symbol: string; range: HistoricalRange }
  | { action: 'portfolio_prices'; portfolioId: string };

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 200 }), corsHeaders);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('Supabase environment variables are missing.');
      return withCors(jsonResponse({ error: 'Server configuration error.' }, { status: 500 }), corsHeaders);
    }

    const userId = await getUserId(req);
    if (!userId) {
      return withCors(jsonResponse({ error: 'Unauthorized' }, { status: 401 }), corsHeaders);
    }

    let payload: MarketDataRequest;
    try {
      payload = await req.json();
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return withCors(jsonResponse({ error: 'Invalid JSON body.' }, { status: 400 }), corsHeaders);
    }

    if (!payload || typeof payload !== 'object') {
      return withCors(jsonResponse({ error: 'Invalid request payload.' }, { status: 400 }), corsHeaders);
    }

    switch (payload.action) {
      case 'quote': {
        const symbol = payload.symbol?.trim().toUpperCase();
        if (!symbol) {
          return withCors(jsonResponse({ error: 'Symbol is required.' }, { status: 400 }), corsHeaders);
        }

        try {
          const quote = await fetchYahooQuote(symbol);

          const { data: symbolRecord } = await adminClient
            .from('symbols')
            .select('id')
            .eq('owner_id', userId)
            .eq('ticker', symbol)
            .maybeSingle();

          if (symbolRecord?.id) {
            try {
              await persistQuote(symbolRecord.id, quote);
            } catch (error) {
              console.error(`Failed to persist quote for ${symbol}:`, error);
            }
          }

          return withCors(jsonResponse({ ...quote, provider: 'yahoo' }), corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to fetch quote.';
          console.error(`Quote request failed for ${symbol}:`, message);
          return withCors(jsonResponse({ error: message }, { status: 502 }), corsHeaders);
        }
      }

      case 'refresh_prices': {
        const normalizedTickers = normalizeTickers(payload.symbols);
        let symbols;

        try {
          symbols = await loadSymbolsForUser(userId, normalizedTickers);
        } catch (error) {
          console.error('Failed to load symbols for refresh:', error);
          return withCors(jsonResponse({ error: 'Unable to load symbols.' }, { status: 500 }), corsHeaders);
        }

        const missingTickers = normalizedTickers.length
          ? normalizedTickers.filter(ticker => !symbols.some(symbol => symbol.ticker.toUpperCase() === ticker))
          : [];

        if (!symbols.length) {
          const summary: PriceUpdateSummary = {
            provider: 'yahoo',
            totalSymbols: 0,
            updated: 0,
            failed: missingTickers.length,
            errors: missingTickers.map(ticker => ({ ticker, message: 'Symbol not found for current user.' })),
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          };

          return withCors(jsonResponse(summary), corsHeaders);
        }

        const startedAt = new Date();
        const errors: PriceUpdateErrorDetail[] = missingTickers.map(ticker => ({
          ticker,
          message: 'Symbol not found for current user.'
        }));

        let updated = 0;

        for (const symbol of symbols) {
          try {
            const quote = await fetchYahooQuote(symbol.ticker);
            await persistQuote(symbol.id, quote);
            updated += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to refresh quote.';
            errors.push({ ticker: symbol.ticker, message });
            console.error(`Failed to refresh ${symbol.ticker}:`, message);
          }

          await sleep(150);
        }

        const completedAt = new Date();

        const summary: PriceUpdateSummary = {
          provider: 'yahoo',
          totalSymbols: symbols.length,
          updated,
          failed: errors.length,
          errors,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString()
        };

        return withCors(jsonResponse(summary), corsHeaders);
      }

      case 'historical': {
        const symbol = payload.symbol?.trim().toUpperCase();
        const range = payload.range;

        if (!symbol) {
          return withCors(jsonResponse({ error: 'Symbol is required.' }, { status: 400 }), corsHeaders);
        }

        if (!range || !YAHOO_RANGE_CONFIG[range]) {
          return withCors(jsonResponse({ error: 'Invalid range supplied.' }, { status: 400 }), corsHeaders);
        }

        try {
          const points = await fetchYahooHistorical(symbol, range);
          return withCors(jsonResponse({ symbol, range, provider: 'yahoo', points }), corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch historical prices.';
          console.error(`Historical request failed for ${symbol}:`, message);
          return withCors(jsonResponse({ error: message }, { status: 502 }), corsHeaders);
        }
      }

      case 'portfolio_prices': {
        const portfolioId = payload.portfolioId?.trim();

        if (!portfolioId) {
          return withCors(jsonResponse({ error: 'Portfolio ID is required.' }, { status: 400 }), corsHeaders);
        }

        let symbols: Array<{ id: string; ticker: string }> = [];

        try {
          symbols = await loadPortfolioSymbols(userId, portfolioId);
        } catch (error) {
          console.error(`Failed to load symbols for portfolio ${portfolioId}:`, error);
          return withCors(jsonResponse({ error: 'Unable to load portfolio symbols.' }, { status: 500 }), corsHeaders);
        }

        if (!symbols.length) {
          const emptySummary = {
            provider: 'yahoo' as const,
            portfolioId,
            totalSymbols: 0,
            updated: 0,
            failed: 0,
            quotes: [] as LiveQuote[],
            errors: [] as PriceUpdateErrorDetail[],
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          };

          return withCors(jsonResponse(emptySummary), corsHeaders);
        }

        const startedAt = new Date();
        const errors: PriceUpdateErrorDetail[] = [];
        const quotes: LiveQuote[] = [];

        for (const symbol of symbols) {
          try {
            const quote = await fetchYahooQuote(symbol.ticker);
            quotes.push(quote);
            await persistQuote(symbol.id, quote);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch quote for symbol.';
            errors.push({ ticker: symbol.ticker, message });
            console.error(`Failed to refresh ${symbol.ticker} for portfolio ${portfolioId}:`, message);
          }

          await sleep(150);
        }

        const completedAt = new Date();

        const summary = {
          provider: 'yahoo' as const,
          portfolioId,
          totalSymbols: symbols.length,
          updated: quotes.length,
          failed: errors.length,
          quotes,
          errors,
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString()
        };

        return withCors(jsonResponse(summary), corsHeaders);
      }

      default: {
        return withCors(jsonResponse({ error: 'Unsupported action.' }, { status: 400 }), corsHeaders);
      }
    }
  } catch (error) {
    console.error('Unexpected market-data error:', error);
    return withCors(jsonResponse({ error: 'Unexpected server error.' }, { status: 500 }), corsHeaders);
  }
});
