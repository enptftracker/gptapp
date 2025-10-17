import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface CompanyNewsRequest {
  ticker?: string;
  from?: string;
  to?: string;
}

interface FinnhubCompanyNewsItem {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number | string;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

interface CompanyNewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface CompanyNewsResponse {
  symbol: string;
  news: CompanyNewsItem[];
  provider: "finnhub";
}

const FINNHUB_COMPANY_NEWS_ENDPOINT =
  "https://finnhub.io/api/v1/company-news";
const MAX_ARTICLES = 6;
const DEFAULT_LOOKBACK_DAYS = 7;

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

const sanitizeText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

const computeDateRange = (
  from?: string,
  to?: string,
): { from: string; to: string } => {
  const now = new Date();
  const toDate = to ?? now.toISOString().split("T")[0];

  if (from) {
    return { from, to: toDate };
  }

  const lookback = new Date(now.getTime());
  lookback.setUTCDate(lookback.getUTCDate() - DEFAULT_LOOKBACK_DAYS);

  return {
    from: lookback.toISOString().split("T")[0],
    to: toDate,
  };
};

const toIsoDateTime = (timestamp?: number): string | undefined => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return undefined;
  }

  const milliseconds = timestamp * 1000;
  const date = new Date(milliseconds);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const deriveSentimentFromHeadline = (
  headline: string | undefined,
): "positive" | "negative" | "neutral" => {
  if (!headline) {
    return "neutral";
  }

  const normalized = headline.toLowerCase();
  const positiveKeywords = [
    "beats",
    "growth",
    "surge",
    "rises",
    "record",
    "upgrade",
    "outperform",
  ];
  const negativeKeywords = [
    "falls",
    "drop",
    "misses",
    "downgrade",
    "lawsuit",
    "investigation",
    "plunge",
  ];

  if (positiveKeywords.some((keyword) => normalized.includes(keyword))) {
    return "positive";
  }

  if (negativeKeywords.some((keyword) => normalized.includes(keyword))) {
    return "negative";
  }

  return "neutral";
};

const normalizeNewsItem = (
  item: FinnhubCompanyNewsItem,
  ticker: string,
): CompanyNewsItem => {
  const title =
    sanitizeText(item.headline) ?? `${ticker} latest market coverage`;
  const url =
    sanitizeText(item.url) ??
    `https://www.google.com/search?q=${ticker}+stock+news`;
  const publisher = sanitizeText(item.source) ?? "Market News";
  const publishedAt =
    toIsoDateTime(item.datetime) ?? new Date().toISOString();
  const summary =
    sanitizeText(item.summary) ??
    `Explore the most recent headlines and analysis for ${ticker}.`;

  return {
    title,
    url,
    publisher,
    publishedAt,
    summary,
    sentiment: deriveSentimentFromHeadline(item.headline),
  };
};

const fetchCompanyNews = async (
  ticker: string,
  dateRange: { from: string; to: string },
): Promise<CompanyNewsItem[]> => {
  const apiKey = getFinnhubApiKey();
  const url = new URL(FINNHUB_COMPANY_NEWS_ENDPOINT);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("from", dateRange.from);
  url.searchParams.set("to", dateRange.to);
  url.searchParams.set("token", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const upstreamStatus = response.status;
    throw new HttpError(
      `Finnhub API error: ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new HttpError(
      "Finnhub company news response is invalid",
      502,
      payload,
    );
  }

  const normalized = payload
    .filter((item): item is FinnhubCompanyNewsItem =>
      item && typeof item === "object"
    )
    .map((item) => normalizeNewsItem(item, ticker))
    .filter((item) => item.title && item.url);

  return normalized
    .sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, MAX_ARTICLES);
};

export const handleFetchCompanyNews = async (
  req: Request,
): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const isJson =
      req.headers.get("content-type")?.includes("application/json") ?? false;
    const payload: CompanyNewsRequest =
      req.method === "POST" && isJson ? await req.json() : {};

    const ticker = sanitizeText(payload.ticker)?.toUpperCase();

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: "Ticker symbol is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const dateRange = computeDateRange(payload.from, payload.to);

    console.log(
      `Fetching company news from Finnhub for ${ticker} (${dateRange.from} -> ${dateRange.to})`,
    );

    const news = await fetchCompanyNews(ticker, dateRange);
    const body: CompanyNewsResponse = {
      symbol: ticker,
      news,
      provider: "finnhub",
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error in fetch-company-news:", err);

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
      JSON.stringify({ error: message, details: "Failed to fetch news" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

if (import.meta.main) {
  serve(handleFetchCompanyNews);
}
