import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface StockRequest {
  ticker: string;
}

const FINNHUB_QUOTE_ENDPOINT = "https://finnhub.io/api/v1/quote";

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
  const tradingDay = normalizeTradingDay(finnhubData.t ?? undefined);

  return {
    symbol: ticker,
    price,
    change,
    changePercent,
    high: typeof high === "number" ? high : undefined,
    low: typeof low === "number" ? low : undefined,
    volume: undefined,
    tradingDay,
    provider: "finnhub" as const,
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
    console.log(`Fetching stock data from Finnhub for: ${ticker}`);

    const stockData = await fetchFinnhubQuote(ticker);

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
