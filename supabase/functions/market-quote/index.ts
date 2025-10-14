import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

type GlobalQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
  lastUpdated: string;
  provider: 'alphavantage';
};

type QuotePayload = {
  '01. symbol'?: string;
  '02. open'?: string;
  '03. high'?: string;
  '04. low'?: string;
  '05. price'?: string;
  '06. volume'?: string;
  '07. latest trading day'?: string;
  '08. previous close'?: string;
  '09. change'?: string;
  '10. change percent'?: string;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[%,$]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeTicker = (value: string | null | undefined): string =>
  (value ?? '')
    .trim()
    .toUpperCase();

const jsonResponse = (body: unknown, status: number, corsHeaders: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });

const handleRequest = async (request: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(request.headers.get('Origin'));

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch (error) {
    console.error('Failed to parse request payload:', error);
    return jsonResponse({ error: 'Invalid JSON payload' }, 400, corsHeaders);
  }

  const tickerInput =
    typeof payload['ticker'] === 'string'
      ? (payload['ticker'] as string)
      : typeof payload['symbol'] === 'string'
        ? (payload['symbol'] as string)
        : null;

  const ticker = normalizeTicker(tickerInput);

  if (!ticker) {
    return jsonResponse({ error: 'Ticker symbol is required' }, 400, corsHeaders);
  }

  const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!apiKey) {
    console.error('ALPHA_VANTAGE_API_KEY is not configured');
    return jsonResponse({ error: 'Alpha Vantage API key is not configured' }, 500, corsHeaders);
  }

  const url = new URL('https://www.alphavantage.co/query');
  url.searchParams.set('function', 'GLOBAL_QUOTE');
  url.searchParams.set('symbol', ticker);
  url.searchParams.set('apikey', apiKey);

  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    console.error('Alpha Vantage network request failed:', error);
    return jsonResponse({ error: 'Failed to reach Alpha Vantage' }, 502, corsHeaders);
  }

  if (!response.ok) {
    console.error('Alpha Vantage returned an error response:', response.status, response.statusText);
    return jsonResponse({ error: `Alpha Vantage error: ${response.statusText}` }, response.status, corsHeaders);
  }

  let data: Record<string, unknown>;

  try {
    data = await response.json();
  } catch (error) {
    console.error('Failed to parse Alpha Vantage response:', error);
    return jsonResponse({ error: 'Invalid response from Alpha Vantage' }, 502, corsHeaders);
  }

  const providerError = (data['Error Message'] ?? data['Note'] ?? data['Information']);
  if (typeof providerError === 'string' && providerError.trim().length > 0) {
    console.error('Alpha Vantage provider error:', providerError);
    return jsonResponse({ error: providerError.trim() }, 502, corsHeaders);
  }

  const rawQuote = (data['Global Quote'] ?? null) as QuotePayload | null;

  if (!rawQuote || Object.keys(rawQuote).length === 0) {
    return jsonResponse({ error: 'No quote data found for ticker', symbol: ticker }, 404, corsHeaders);
  }

  const price = toNumber(rawQuote['05. price']);
  if (typeof price !== 'number') {
    return jsonResponse({ error: 'Invalid price returned from Alpha Vantage' }, 502, corsHeaders);
  }

  const change = toNumber(rawQuote['09. change']) ?? 0;
  const changePercent = toNumber(rawQuote['10. change percent']) ?? 0;
  const volume = toNumber(rawQuote['06. volume']);
  const high = toNumber(rawQuote['03. high']);
  const low = toNumber(rawQuote['04. low']);
  const lastTradingDay = rawQuote['07. latest trading day'];
  const lastUpdated = typeof lastTradingDay === 'string' && lastTradingDay.trim().length > 0
    ? new Date(`${lastTradingDay}T00:00:00Z`).toISOString()
    : new Date().toISOString();

  const payloadResponse: GlobalQuote = {
    symbol: ticker,
    price,
    change,
    changePercent,
    volume,
    high,
    low,
    lastUpdated,
    provider: 'alphavantage'
  };

  return jsonResponse(payloadResponse, 200, corsHeaders);
};

serve(handleRequest);
