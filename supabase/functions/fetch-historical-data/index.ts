import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

function mergeCandles(existing: HistoricalDataPoint[], response: FinnhubCandleResponse): HistoricalDataPoint[] {
  if (!Array.isArray(response.t) || response.s !== 'ok') {
    return existing;
  }

  const points = response.t.map((timestamp, index) => ({
    timestamp: timestamp * 1000,
    date: new Date(timestamp * 1000).toISOString(),
    open: response.o[index] ?? 0,
    high: response.h[index] ?? 0,
    low: response.l[index] ?? 0,
    close: response.c[index] ?? 0,
    volume: response.v[index] ?? 0,
  } satisfies HistoricalDataPoint));

  return existing.concat(points);
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker, period } = await req.json() as HistoricalRequest;

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Ticker symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FINNHUB_API_KEY');
    if (!apiKey) {
      console.error('FINNHUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const rangeConfig = RANGE_CONFIG[period];

    if (!rangeConfig) {
      return new Response(
        JSON.stringify({ error: 'Unsupported period' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let points: HistoricalDataPoint[] = [];

    if (period === 'MAX') {
      const chunkSize = DAY_SECONDS * 365 * 5; // 5 year chunks
      let to = now;
      let iterations = 0;
      const maxIterations = 200;
      let earliestTimestamp = Number.POSITIVE_INFINITY;

      while (to > 0 && iterations < maxIterations) {
        iterations += 1;
        const from = Math.max(0, to - chunkSize);
        console.log(`Fetching MAX historical data chunk for ${ticker}: ${new Date(from * 1000).toISOString()} - ${new Date(to * 1000).toISOString()}`);
        const candleResponse = await fetchFinnhubCandles(ticker, rangeConfig.resolution, from, to, apiKey);

        if (candleResponse.s === 'no_data' || !candleResponse.t.length) {
          break;
        }

        points = mergeCandles(points, candleResponse);

        const chunkEarliest = candleResponse.t[0] * 1000;
        if (chunkEarliest >= earliestTimestamp) {
          // No progress retrieving older data; stop to avoid infinite loop
          break;
        }
        earliestTimestamp = chunkEarliest;

        to = (candleResponse.t[0] - 1);
      }
    } else {
      const from = Math.max(0, now - (rangeConfig.daysBack ?? 0) * DAY_SECONDS);
      console.log(`Fetching historical data for ${ticker} (${period}) from ${new Date(from * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
      const candleResponse = await fetchFinnhubCandles(ticker, rangeConfig.resolution, from, now, apiKey);

      if (candleResponse.s === 'no_data' || !candleResponse.t.length) {
        return new Response(
          JSON.stringify({ error: 'No historical data available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      points = mergeCandles(points, candleResponse);
    }

    if (!points.length) {
      return new Response(
        JSON.stringify({ error: 'No historical data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deduped = new Map<number, HistoricalDataPoint>();
    for (const point of points) {
      deduped.set(point.timestamp, point);
    }

    const sortedPoints = Array.from(deduped.values()).sort((a, b) => a.timestamp - b.timestamp);
    const filteredPoints = filterByPeriod(sortedPoints, period);

    console.log(`Returning ${filteredPoints.length} data points for ${ticker} (${period})`);

    return new Response(
      JSON.stringify({
        symbol: ticker,
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
