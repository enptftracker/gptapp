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

const buildAlphaVantageResponse = (
  quote: Record<string, string>,
  ticker: string
) => {
  const price = toFiniteNumber(quote["05. price"]);

  if (typeof price !== "number") {
    throw new Error("Alpha Vantage response missing price");
  }

  const change = toFiniteNumber(quote["09. change"]);
  const changePercentRaw = quote["10. change percent"] ?? "";
  const changePercent =
    typeof changePercentRaw === "string"
      ? toFiniteNumber(changePercentRaw.replace("%", ""))
      : undefined;
  const high = toFiniteNumber(quote["03. high"]);
  const low = toFiniteNumber(quote["04. low"]);
  const volume = toFiniteNumber(quote["06. volume"]);

  return {
    symbol: ticker,
    price,
    change: change ?? 0,
    changePercent: changePercent ?? 0,
    high: high ?? undefined,
    low: low ?? undefined,
    volume: typeof volume === "number" ? Math.round(volume) : undefined,
    tradingDay: quote["07. latest trading day"],
    provider: "alphavantage" as const,
  };
};

const fetchYahooFinanceQuote = async (
  ticker: string,
  corsHeaders: HeadersInit
): Promise<Response> => {
  const yahooResponse = await fetch(
    `${YAHOO_FINANCE_ENDPOINT}${encodeURIComponent(ticker)}`,
    {
      headers: getYahooRequestHeaders(),
    }
  );

  if (!yahooResponse.ok) {
    throw new Error(`Yahoo Finance API error: ${yahooResponse.status}`);
  }

  const yahooData = await yahooResponse.json();
  const result =
    yahooData?.quoteResponse?.result &&
    Array.isArray(yahooData.quoteResponse.result)
      ? yahooData.quoteResponse.result[0]
      : undefined;

  if (!result) {
    throw new Error("Yahoo Finance returned no results");
  }

  const price = toFiniteNumber(result.regularMarketPrice);

  if (typeof price !== "number") {
    throw new Error("Yahoo Finance response missing price");
  }

  const change = toFiniteNumber(result.regularMarketChange) ?? 0;
  const changePercent =
    toFiniteNumber(result.regularMarketChangePercent) ?? 0;
  const high = toFiniteNumber(result.regularMarketDayHigh);
  const low = toFiniteNumber(result.regularMarketDayLow);
  const volume = toFiniteNumber(result.regularMarketVolume);
  const tradingDay = normalizeTradingDay(result.regularMarketTime);

  const stockData = {
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

  return new Response(JSON.stringify(stockData), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
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

    const ALPHA_VANTAGE_API_KEY = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    if (!ALPHA_VANTAGE_API_KEY) {
      console.error("ALPHA_VANTAGE_API_KEY not set");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Fetching stock data for: ${ticker}`);

    const r = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
        ticker
      )}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );

    if (!r.ok) {
      throw new Error(`Alpha Vantage API error: ${r.status} ${r.statusText}`);
    }

    const data = await r.json();

    const fallbackNote = data["Note"];
    const fallbackInformation = data["Information"];

    const tryYahooFallback = async () => {
      console.warn(
        "Falling back to Yahoo Finance due to Alpha Vantage response",
        { fallbackNote, fallbackInformation }
      );
      return await fetchYahooFinanceQuote(ticker, corsHeaders);
    };

    if (fallbackNote) {
      try {
        return await tryYahooFallback();
      } catch (fallbackError) {
        console.error("Yahoo Finance fallback failed after rate limit", fallbackError);
        return new Response(
          JSON.stringify({
            error: "API rate limit reached. Please try again shortly.",
            details: fallbackNote,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
              ...corsHeaders,
            },
          },
        );
      }
    }

    if (fallbackInformation) {
      try {
        return await tryYahooFallback();
      } catch (fallbackError) {
        console.error(
          "Yahoo Finance fallback failed after informational response",
          fallbackError
        );
        return new Response(
          JSON.stringify({
            error: "Alpha Vantage temporarily unavailable.",
            details: fallbackInformation,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    }

    if (data["Error Message"]) {
      console.error("Alpha Vantage error:", data["Error Message"]);
      return new Response(
        JSON.stringify({
          error: "Stock not found or invalid ticker symbol",
          details: data["Error Message"],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const quote = data["Global Quote"] as Record<string, string> | undefined;

    if (quote && Object.keys(quote).length > 0) {
      try {
        const stockData = buildAlphaVantageResponse(quote, ticker);
        return new Response(JSON.stringify(stockData), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (mappingError) {
        console.error("Alpha Vantage response missing price:", mappingError);
        return new Response(
          JSON.stringify({
            error: "Stock data incomplete or unavailable",
            details: "Price field missing in Alpha Vantage response.",
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
    } else {
      console.error(`No data for ticker: ${ticker}`, data);
      return new Response(
        JSON.stringify({
          error: "Stock not found or invalid ticker symbol",
          details: data,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (err) {
    console.error("Error in fetch-stock-price:", err);
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
