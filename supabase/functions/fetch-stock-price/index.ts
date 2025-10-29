import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface StockRequest {
  ticker?: string;
  assetType?: string;
  quoteCurrency?: string;
}

const FINNHUB_QUOTE_ENDPOINT = "https://finnhub.io/api/v1/quote";
const FINNHUB_CRYPTO_CANDLE_ENDPOINT = "https://finnhub.io/api/v1/crypto/candle";
const FINNHUB_FOREX_CANDLE_ENDPOINT = "https://finnhub.io/api/v1/forex/candle";

const getFinnhubApiKey = (): string => {
  const apiKey = Deno.env.get("FINNHUB_API_KEY")?.trim();

  if (!apiKey) {
    throw new HttpError(
      "Finnhub API key is not configured",
      500,
      "Missing FINNHUB_API_KEY environment variable",
    );
  }

  return apiKey;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const normalizeTradingDay = (timestamp?: number | null): string | undefined => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return undefined;
  }

  try {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString().split("T")[0];
  } catch (err) {
    console.error("Failed to normalize trading day", err);
    return undefined;
  }
};

const toIsoTimestamp = (timestamp?: number | null): string | undefined => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return undefined;
  }

  try {
    const date = new Date(timestamp * 1000);
    const time = date.getTime();
    if (Number.isNaN(time)) {
      return undefined;
    }

    return date.toISOString();
  } catch (err) {
    console.error("Failed to convert timestamp to ISO string", err);
    return undefined;
  }
};

const extractLatestFromArray = (
  values?: Array<number | string>,
): number | undefined => {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const last = values[values.length - 1];
  return toFiniteNumber(last);
};

const extractLatestTimestamp = (values?: Array<number | null>): number | undefined => {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const last = values[values.length - 1];
  return typeof last === "number" && Number.isFinite(last) ? last : undefined;
};

const fetchFinnhubCandleQuote = async (
  endpoint: string,
  ticker: string,
): Promise<{
  price: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp?: number;
}> => {
  const apiKey = getFinnhubApiKey();
  const url = new URL(endpoint);
  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60; // Look back an hour for a recent candle

  url.searchParams.set("symbol", ticker);
  url.searchParams.set("resolution", "1");
  url.searchParams.set("from", from.toString());
  url.searchParams.set("to", now.toString());
  url.searchParams.set("token", apiKey);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const upstreamStatus = response.status;
    throw new HttpError(
      `Finnhub API error: ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload: FinnhubCandleResponse = await response.json();

  if (!payload || payload.s !== "ok") {
    throw new HttpError(
      "Finnhub candle response is invalid",
      502,
      payload,
    );
  }

  const price = extractLatestFromArray(payload.c);

  if (typeof price !== "number") {
    throw new HttpError(
      "Instrument not found or price unavailable",
      404,
      payload,
    );
  }

  const high = extractLatestFromArray(payload.h);
  const low = extractLatestFromArray(payload.l);
  const volume = extractLatestFromArray(payload.v);
  const timestamp = extractLatestTimestamp(payload.t);

  return { price, high, low, volume, timestamp };
};

const fetchFinnhubCryptoQuote = async (ticker: string) => {
  const candle = await fetchFinnhubCandleQuote(
    FINNHUB_CRYPTO_CANDLE_ENDPOINT,
    ticker,
  );

  return {
    symbol: ticker,
    price: candle.price,
    change: 0,
    changePercent: 0,
    high: candle.high,
    low: candle.low,
    volume: candle.volume,
    tradingDay: candle.timestamp ? normalizeTradingDay(candle.timestamp) : undefined,
    lastUpdated: toIsoTimestamp(candle.timestamp),
    provider: "finnhub" as const,
  };
};

const fetchFinnhubForexQuote = async (ticker: string) => {
  const candle = await fetchFinnhubCandleQuote(
    FINNHUB_FOREX_CANDLE_ENDPOINT,
    ticker,
  );

  return {
    symbol: ticker,
    price: candle.price,
    change: 0,
    changePercent: 0,
    high: candle.high,
    low: candle.low,
    volume: candle.volume,
    tradingDay: candle.timestamp ? normalizeTradingDay(candle.timestamp) : undefined,
    lastUpdated: toIsoTimestamp(candle.timestamp),
    provider: "finnhub" as const,
  };
};

interface FinnhubQuoteResult {
  c?: number | string; // Current price
  d?: number | string; // Change
  dp?: number | string; // Percent change
  h?: number | string; // High price of the day
  l?: number | string; // Low price of the day
  o?: number | string; // Open price of the day
  pc?: number | string; // Previous close price
  t?: number | null; // Timestamp
}

interface FinnhubCandleResponse {
  c?: Array<number | string>;
  h?: Array<number | string>;
  l?: Array<number | string>;
  o?: Array<number | string>;
  v?: Array<number | string>;
  t?: Array<number | null>;
  s?: string;
}

const inferAssetTypeFromTicker = (ticker: string): string | null => {
  const upper = ticker.toUpperCase();
  const [maybeExchange, maybeSymbol] = upper.split(":", 2);
  const symbolPart = maybeSymbol ?? maybeExchange;

  const cryptoExchanges = new Set([
    "BINANCE",
    "COINBASE",
    "KRAKEN",
    "BITSTAMP",
    "BITFINEX",
    "GEMINI",
    "HUOBI",
    "OKX",
    "OKEX",
    "BYBIT",
  ]);

  const forexExchanges = new Set([
    "OANDA",
    "FXCM",
    "FOREX",
    "SAXO",
    "ICMARKETS",
    "PEPPERSTONE",
    "CMC",
    "IDC",
  ]);

  if (maybeSymbol) {
    if (cryptoExchanges.has(maybeExchange)) {
      return "CRYPTO";
    }

    if (forexExchanges.has(maybeExchange)) {
      return "FX";
    }
  }

  const stablecoinSuffixes = ["USDT", "USDC", "BUSD", "USDP", "TUSD"];

  const normalizedSymbol = symbolPart.replace(/[^A-Z]/g, "");

  if (/^[A-Z]{6}$/.test(normalizedSymbol)) {
    return "FX";
  }

  for (const suffix of stablecoinSuffixes) {
    if (symbolPart.endsWith(suffix)) {
      return "CRYPTO";
    }
  }

  const splitParts = symbolPart.split(/[-_/]/).filter(Boolean);
  if (splitParts.length >= 2) {
    const quote = splitParts[splitParts.length - 1];
    if (stablecoinSuffixes.includes(quote)) {
      return "CRYPTO";
    }

    if (quote.length === 3) {
      return "FX";
    }
  }

  return null;
};

const fetchFinnhubQuote = async (ticker: string) => {
  const apiKey = getFinnhubApiKey();
  const url = new URL(FINNHUB_QUOTE_ENDPOINT);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("token", apiKey);

  const finnhubResponse = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!finnhubResponse.ok) {
    const upstreamStatus = finnhubResponse.status;
    throw new HttpError(
      `Finnhub API error: ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const finnhubData: FinnhubQuoteResult | undefined =
    await finnhubResponse.json();

  if (!finnhubData || typeof finnhubData !== "object") {
    throw new HttpError(
      "Finnhub quote response is invalid",
      502,
      finnhubData,
    );
  }

  const price = toFiniteNumber(finnhubData.c);

  if (typeof price !== "number") {
    throw new HttpError(
      "Stock not found or invalid ticker symbol",
      404,
      finnhubData,
    );
  }

  const change = toFiniteNumber(finnhubData.d) ?? 0;
  const changePercent = toFiniteNumber(finnhubData.dp) ?? 0;
  const high = toFiniteNumber(finnhubData.h);
  const low = toFiniteNumber(finnhubData.l);
  const rawTimestamp = finnhubData.t ?? undefined;
  const tradingDay = normalizeTradingDay(rawTimestamp);
  const lastUpdated = toIsoTimestamp(rawTimestamp);

  return {
    symbol: ticker,
    price,
    change,
    changePercent,
    high: typeof high === "number" ? high : undefined,
    low: typeof low === "number" ? low : undefined,
    volume: undefined,
    tradingDay,
    lastUpdated,
    provider: "finnhub" as const,
  };
};

const fetchQuoteByAssetType = async (
  ticker: string,
  assetType?: string,
) => {
  const normalized = assetType?.trim().toUpperCase();
  const inferred = normalized && normalized.length > 0
    ? normalized
    : inferAssetTypeFromTicker(ticker) ?? undefined;

  if (inferred === "CRYPTO") {
    return fetchFinnhubCryptoQuote(ticker);
  }

  if (inferred === "FX" || inferred === "FOREX" || inferred === "CURRENCY") {
    return fetchFinnhubForexQuote(ticker);
  }

  return fetchFinnhubQuote(ticker);
};

export const handleFetchStockPrice = async (
  req: Request
): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  // 1) Always answer preflight with 200 + proper CORS + a tiny body
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // 2) Only parse JSON for non-GET methods
    const isJson =
      req.headers.get("content-type")?.includes("application/json") ?? false;

    const payload: Partial<StockRequest> =
      req.method === "POST" && isJson ? await req.json() : {};

    const ticker = typeof payload?.ticker === "string" ? payload.ticker.trim() : "";
    const assetType = payload?.assetType;

    if (!ticker) {
      return new Response(JSON.stringify({ error: "Ticker symbol is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log(`Fetching market data for: ${ticker} (${assetType ?? 'auto'})`);

    const stockData = await fetchQuoteByAssetType(ticker, assetType);

    return new Response(JSON.stringify(stockData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error in fetch-stock-price:", err);
    if (err instanceof HttpError) {
      const body: Record<string, unknown> = { error: err.message };
      if (err.details) {
        body.details = err.details;
      }

      return new Response(JSON.stringify(body), {
        status: err.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, details: "Failed to fetch stock data" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

if (import.meta.main) {
  serve(handleFetchStockPrice);
}
