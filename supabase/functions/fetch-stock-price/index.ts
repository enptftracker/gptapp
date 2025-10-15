import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface StockRequest {
  ticker: string;
}

const YAHOO_FINANCE_ENDPOINT =
  "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const DEFAULT_YAHOO_USER_AGENT =
  "Mozilla/5.0 (compatible; PortfolioOpusSupabaseFunction/1.0; +https://github.com/openai/gptapp)";

const getYahooRequestHeaders = (): HeadersInit => {
  const configuredUserAgent = Deno.env.get("YAHOO_USER_AGENT")?.trim();
  const userAgent =
    configuredUserAgent && configuredUserAgent.length > 0
      ? configuredUserAgent
      : DEFAULT_YAHOO_USER_AGENT;

  return {
    "User-Agent": userAgent,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://finance.yahoo.com/",
  };
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
    console.error("Failed to normalize Yahoo trading day", err);
    return undefined;
  }
};

interface YahooQuoteResult {
  symbol?: string;
  regularMarketPrice?: number | string;
  regularMarketChange?: number | string;
  regularMarketChangePercent?: number | string;
  regularMarketDayHigh?: number | string;
  regularMarketDayLow?: number | string;
  regularMarketVolume?: number | string;
  regularMarketTime?: number | null;
}

const fetchYahooFinanceQuote = async (ticker: string) => {
  const yahooResponse = await fetch(
    `${YAHOO_FINANCE_ENDPOINT}${encodeURIComponent(ticker)}`,
    {
      headers: getYahooRequestHeaders(),
    },
  );

  if (!yahooResponse.ok) {
    const upstreamStatus = yahooResponse.status;
    throw new HttpError(
      `Yahoo Finance API error: ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const yahooData = await yahooResponse.json();
  const results: YahooQuoteResult[] =
    yahooData?.quoteResponse?.result &&
    Array.isArray(yahooData.quoteResponse.result)
      ? yahooData.quoteResponse.result
      : [];

  const result = results[0];

  if (!result) {
    throw new HttpError(
      "Stock not found or invalid ticker symbol",
      404,
      yahooData,
    );
  }

  const price = toFiniteNumber(result.regularMarketPrice);

  if (typeof price !== "number") {
    throw new HttpError("Yahoo Finance response missing price", 502, result);
  }

  const change = toFiniteNumber(result.regularMarketChange) ?? 0;
  const changePercent =
    toFiniteNumber(result.regularMarketChangePercent) ?? 0;
  const high = toFiniteNumber(result.regularMarketDayHigh);
  const low = toFiniteNumber(result.regularMarketDayLow);
  const volume = toFiniteNumber(result.regularMarketVolume);
  const tradingDay = normalizeTradingDay(result.regularMarketTime ?? undefined);

  return {
    symbol: result.symbol ?? ticker,
    price,
    change,
    changePercent,
    high: high ?? undefined,
    low: low ?? undefined,
    volume: typeof volume === "number" ? Math.round(volume) : undefined,
    tradingDay,
    provider: "yfinance" as const,
  };
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

    const ticker = payload?.ticker;

    if (!ticker) {
      return new Response(JSON.stringify({ error: "Ticker symbol is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log(`Fetching stock data from Yahoo Finance for: ${ticker}`);

    const stockData = await fetchYahooFinanceQuote(ticker);

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
