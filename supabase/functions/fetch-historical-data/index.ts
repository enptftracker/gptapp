import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

interface HistoricalRequest {
  ticker: string;
  period: '1D' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';
}

type FinnhubCandleStatus = 'ok' | 'no_data';

interface FinnhubCandleResponse {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: FinnhubCandleStatus;
}

interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type FinnhubResolution = '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M';

const DAY_SECONDS = 60 * 60 * 24;

const RESOLUTION_SECONDS: Record<FinnhubResolution, number> = {
  '1': 60,
  '5': 60 * 5,
  '15': 60 * 15,
  '30': 60 * 30,
  '60': 60 * 60,
  'D': DAY_SECONDS,
  'W': DAY_SECONDS * 7,
  'M': DAY_SECONDS * 30,
};

const RANGE_CONFIG: Record<HistoricalRequest['period'], { resolution: FinnhubResolution; daysBack?: number; }> = {
  '1D': { resolution: '5', daysBack: 2 },
  '1M': { resolution: 'D', daysBack: 30 },
  '3M': { resolution: 'D', daysBack: 90 },
  '1Y': { resolution: 'D', daysBack: 365 },
  '5Y': { resolution: 'D', daysBack: 365 * 5 },
  'MAX': { resolution: 'D' },
};

async function fetchFinnhubCandles(
  symbol: string,
  resolution: FinnhubResolution,
  from: number,
  to: number,
  apiKey: string,
): Promise<FinnhubCandleResponse> {
  const url = new URL('https://finnhub.io/api/v1/stock/candle');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('resolution', resolution);
  url.searchParams.set('from', Math.floor(from).toString());
  url.searchParams.set('to', Math.floor(to).toString());
  url.searchParams.set('token', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Finnhub request failed with status ${response.status}`);
  }

  const data = await response.json() as FinnhubCandleResponse & { error?: string };

  if (data.error) {
    throw new Error(`Finnhub error: ${data.error}`);
  }

  return data;
}

function candlesToPoints(response: FinnhubCandleResponse): HistoricalDataPoint[] {
  if (!Array.isArray(response.t) || response.s !== 'ok') {
    return [];
  }

  return response.t.map((timestamp, index) => ({
    timestamp: timestamp * 1000,
    date: new Date(timestamp * 1000).toISOString(),
    open: response.o[index] ?? 0,
    high: response.h[index] ?? 0,
    low: response.l[index] ?? 0,
    close: response.c[index] ?? 0,
    volume: response.v[index] ?? 0,
  } satisfies HistoricalDataPoint));
}

const PERIOD_FILTER_WINDOWS: Partial<Record<HistoricalRequest['period'], number>> = {
  '1D': DAY_SECONDS * 1000,
  '1M': DAY_SECONDS * 30 * 1000,
  '3M': DAY_SECONDS * 90 * 1000,
  '1Y': DAY_SECONDS * 365 * 1000,
  '5Y': DAY_SECONDS * 365 * 5 * 1000,
};

function filterByPeriod(points: HistoricalDataPoint[], period: HistoricalRequest['period']): HistoricalDataPoint[] {
  if (period === 'MAX' || points.length === 0) {
    return points;
  }

  const window = PERIOD_FILTER_WINDOWS[period];
  if (!window) {
    return points;
  }

  const latestTimestamp = points[points.length - 1].timestamp;
  const cutoff = latestTimestamp - window;
  return points.filter((point) => point.timestamp >= cutoff);
}

function dedupeAndSort(points: HistoricalDataPoint[]): HistoricalDataPoint[] {
  const deduped = new Map<number, HistoricalDataPoint>();

  for (const point of points) {
    if (Number.isFinite(point.timestamp)) {
      deduped.set(point.timestamp, point);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function getResolutionPaddingSeconds(resolution: FinnhubResolution): number {
  return RESOLUTION_SECONDS[resolution] ?? 60;
}

type SupabaseClient = ReturnType<typeof createClient> | null;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Supabase credentials are not fully configured; historical cache disabled');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client', err);
    return null;
  }
}

async function upsertHistoricalCache(
  supabase: NonNullable<SupabaseClient>,
  symbolId: string,
  points: HistoricalDataPoint[],
) {
  if (!points.length) {
    return;
  }

  const payload = points.map((point) => ({
    date: point.date,
    price: point.close,
    price_currency: 'USD',
  }));

  const { error } = await supabase.rpc('upsert_historical_price_cache', {
    p_symbol_id: symbolId,
    p_points: payload,
  });

  if (error) {
    throw error;
  }
}

function parseCacheRow(row: { date: string; price: number }): HistoricalDataPoint | null {
  const timestamp = Date.parse(row.date);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const price = typeof row.price === 'number' ? row.price : Number.NaN;
  if (!Number.isFinite(price)) {
    return null;
  }

  return {
    timestamp,
    date: new Date(timestamp).toISOString(),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
  } satisfies HistoricalDataPoint;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const method = req.method.toUpperCase();
    const isJson = req.headers.get('content-type')?.includes('application/json') ?? false;

    let payload: Partial<HistoricalRequest> = {};

    if (method === 'POST') {
      if (!isJson) {
        return new Response(
          JSON.stringify({ error: 'Request body must be JSON' }),
          {
            status: 415,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      try {
        payload = await req.json() as Partial<HistoricalRequest>;
      } catch (parseError) {
        console.error('Failed to parse fetch-historical-data payload', parseError);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    } else if (method === 'GET') {
      const url = new URL(req.url);
      const tickerParam = url.searchParams.get('ticker') ?? undefined;
      const periodParam = url.searchParams.get('period') ?? undefined;
      payload = {
        ticker: tickerParam ?? undefined,
        period: periodParam as HistoricalRequest['period'] | undefined,
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const ticker = typeof payload.ticker === 'string' ? payload.ticker : '';
    const normalizedTicker = normalizeTicker(ticker);

    if (!normalizedTicker) {
      return new Response(
        JSON.stringify({ error: 'Ticker symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedPeriods: HistoricalRequest['period'][] = ['1D', '1M', '3M', '1Y', '5Y', 'MAX'];
    const periodInput = typeof payload.period === 'string'
      ? payload.period.toUpperCase()
      : undefined;
    const period = allowedPeriods.find((value) => value === periodInput) ?? undefined;

    const apiKey = Deno.env.get('FINNHUB_API_KEY');
    if (!apiKey) {
      console.error('FINNHUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!period) {
      return new Response(
        JSON.stringify({ error: 'Unsupported period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient();
    let symbolId: string | null = null;

    if (supabase) {
      try {
        const { data: symbol, error: symbolError } = await supabase
          .from('symbols')
          .select('id, ticker')
          .eq('ticker', normalizedTicker)
          .limit(1)
          .maybeSingle();

        if (symbolError) {
          throw symbolError;
        }

        symbolId = symbol?.id ?? null;

        if (!symbolId) {
          console.info(`No symbol found for ticker ${normalizedTicker}; skipping cache usage`);
        }
      } catch (symbolLookupError) {
        console.error('Failed to lookup symbol for historical cache', symbolLookupError);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const rangeConfig = RANGE_CONFIG[period];

    if (!rangeConfig) {
      return new Response(
        JSON.stringify({ error: 'Unsupported period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolutionPadding = getResolutionPaddingSeconds(rangeConfig.resolution);
    let cachedPoints: HistoricalDataPoint[] = [];

    if (supabase && symbolId) {
      try {
        const { data: cacheRows, error: cacheError } = await supabase
          .from('historical_price_cache')
          .select('date, price')
          .eq('symbol_id', symbolId)
          .order('date', { ascending: true });

        if (cacheError) {
          throw cacheError;
        }

        cachedPoints = dedupeAndSort((cacheRows ?? [])
          .map(parseCacheRow)
          .filter((point): point is HistoricalDataPoint => Boolean(point)));
      } catch (cacheReadError) {
        console.error('Failed to read historical price cache', cacheReadError);
      }
    }

    const desiredFrom = rangeConfig.daysBack
      ? Math.max(0, now - rangeConfig.daysBack * DAY_SECONDS)
      : undefined;

    const cachedCoverageSatisfied = (() => {
      if (!cachedPoints.length || desiredFrom === undefined) {
        return false;
      }

      const earliestCached = Math.floor(cachedPoints[0].timestamp / 1000);
      const latestCached = Math.floor(cachedPoints[cachedPoints.length - 1].timestamp / 1000);

      return earliestCached <= desiredFrom && latestCached >= (now - resolutionPadding);
    })();

    if (cachedCoverageSatisfied) {
      const filteredPoints = filterByPeriod(cachedPoints, period);

      if (filteredPoints.length) {
        console.log(`Serving ${filteredPoints.length} cached data points for ${normalizedTicker} (${period})`);
        return new Response(
          JSON.stringify({
            symbol: normalizedTicker,
            period,
            resolution: rangeConfig.resolution,
            data: filteredPoints,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let points: HistoricalDataPoint[] = cachedPoints;
    const newPoints: HistoricalDataPoint[] = [];

    if (period === 'MAX') {
      const chunkSize = DAY_SECONDS * 365 * 5; // 5 year chunks
      const maxIterations = 200;

      const latestCached = cachedPoints.length
        ? Math.floor(cachedPoints[cachedPoints.length - 1].timestamp / 1000)
        : undefined;

      if (!cachedPoints.length || !latestCached || now - latestCached > resolutionPadding) {
        const from = latestCached ?? Math.max(0, now - chunkSize);
        console.log(`Fetching recent MAX historical data for ${normalizedTicker}: ${new Date(from * 1000).toISOString()} - ${new Date(now * 1000).toISOString()}`);
        const candleResponse = await fetchFinnhubCandles(normalizedTicker, rangeConfig.resolution, from, now, apiKey);

        if (candleResponse.s === 'ok' && candleResponse.t.length) {
          newPoints.push(...candlesToPoints(candleResponse));
        }
      }

      let earliestCachedSeconds = cachedPoints.length
        ? Math.floor(cachedPoints[0].timestamp / 1000)
        : Number.POSITIVE_INFINITY;

      if (!Number.isFinite(earliestCachedSeconds)) {
        earliestCachedSeconds = Number.POSITIVE_INFINITY;
      }

      let to = Number.isFinite(earliestCachedSeconds)
        ? earliestCachedSeconds - 1
        : now - chunkSize;
      let iterations = 0;

      while (to > 0 && iterations < maxIterations) {
        iterations += 1;
        const from = Math.max(0, to - chunkSize);

        if (from >= to) {
          break;
        }

        console.log(`Fetching historical data gap for ${normalizedTicker}: ${new Date(from * 1000).toISOString()} - ${new Date(to * 1000).toISOString()}`);
        const candleResponse = await fetchFinnhubCandles(normalizedTicker, rangeConfig.resolution, from, to, apiKey);

        if (candleResponse.s !== 'ok' || !candleResponse.t.length) {
          break;
        }

        const pointsChunk = candlesToPoints(candleResponse);
        newPoints.push(...pointsChunk);

        const chunkEarliest = candleResponse.t[0];
        if (!Number.isFinite(chunkEarliest)) {
          break;
        }

        if (earliestCachedSeconds <= chunkEarliest) {
          break;
        }

        earliestCachedSeconds = Math.min(earliestCachedSeconds, chunkEarliest);
        to = chunkEarliest - 1;
      }
    } else {
      const ranges: Array<{ from: number; to: number }> = [];

      if (!cachedPoints.length || desiredFrom === undefined) {
        const from = desiredFrom ?? Math.max(0, now - (rangeConfig.daysBack ?? 0) * DAY_SECONDS);
        ranges.push({ from, to: now });
      } else {
        const earliestCached = Math.floor(cachedPoints[0].timestamp / 1000);
        const latestCached = Math.floor(cachedPoints[cachedPoints.length - 1].timestamp / 1000);

        if (desiredFrom < earliestCached - resolutionPadding) {
          ranges.push({ from: desiredFrom, to: earliestCached - 1 });
        }

        if (now - latestCached > resolutionPadding) {
          ranges.push({ from: latestCached, to: now });
        }
      }

      for (const range of ranges) {
        if (range.to <= range.from) {
          continue;
        }

        console.log(`Fetching historical data for ${normalizedTicker} (${period}) from ${new Date(range.from * 1000).toISOString()} to ${new Date(range.to * 1000).toISOString()}`);
        const candleResponse = await fetchFinnhubCandles(normalizedTicker, rangeConfig.resolution, range.from, range.to, apiKey);

        if (candleResponse.s === 'ok' && candleResponse.t.length) {
          newPoints.push(...candlesToPoints(candleResponse));
        }
      }
    }

    if (supabase && symbolId && newPoints.length) {
      try {
        await upsertHistoricalCache(supabase, symbolId, dedupeAndSort(newPoints));
      } catch (cacheWriteError) {
        console.error('Failed to update historical price cache', cacheWriteError);
      }
    }

    points = dedupeAndSort(points.concat(newPoints));

    if (!points.length) {
      return new Response(
        JSON.stringify({ error: 'No historical data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const filteredPoints = filterByPeriod(points, period);

    if (!filteredPoints.length) {
      return new Response(
        JSON.stringify({ error: 'No historical data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Returning ${filteredPoints.length} data points for ${normalizedTicker} (${period})`);

    return new Response(
      JSON.stringify({
        symbol: normalizedTicker,
        period,
        resolution: rangeConfig.resolution,
        data: filteredPoints,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching historical data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch historical data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
