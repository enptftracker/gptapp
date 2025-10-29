import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  filterAllowedFinnhubResults,
  type FinnhubSearchEntry,
} from "./exchangeFilter.ts";

interface SearchRequest {
  query?: string;
}

interface FinnhubSearchResponse {
  count?: number;
  result?: FinnhubSearchEntry[];
}

interface SymbolSearchResult {
  ticker: string;
  name: string;
  assetType: string;
  quoteCurrency: string;
}

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

const FINNHUB_SEARCH_ENDPOINT = "https://finnhub.io/api/v1/search";

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

const normalizeTicker = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAssetType = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "EQUITY";
  }

  const normalized = value.trim().toUpperCase();

  if (normalized.includes("CRYPTO")) {
    return "CRYPTO";
  }

  if (normalized === "CRYPTO") {
    return "CRYPTO";
  }

  if (normalized.includes("FOREX") || normalized === "FX" || normalized.includes("CURRENCY")) {
    return "FX";
  }

  if (normalized.includes("ETF")) {
    return "ETF";
  }

  if (normalized.includes("FUND") || normalized.includes("MUTUAL")) {
    return "FUND";
  }

  return "EQUITY";
};

const normalizeCurrency = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const stablecoinMap: Record<string, string> = {
  USDT: "USD",
  USDC: "USD",
  BUSD: "USD",
  USDP: "USD",
  TUSD: "USD",
};

const normalizeQuoteCurrency = (value?: string | null): string | null => {
  const normalized = normalizeCurrency(value);
  if (!normalized) {
    return null;
  }

  return stablecoinMap[normalized] ?? normalized;
};

const extractQuoteFromSymbol = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const upper = value.toUpperCase();
  const withoutPrefix = upper.includes(":") ? upper.split(":").pop() ?? upper : upper;

  const separators = ["/", "-", "_"];
  for (const separator of separators) {
    if (withoutPrefix.includes(separator)) {
      const parts = withoutPrefix.split(separator).filter(Boolean);
      if (parts.length >= 2) {
        return parts[parts.length - 1]?.toUpperCase() ?? null;
      }
    }
  }

  const stablecoinSuffixes = Object.keys(stablecoinMap);
  for (const suffix of stablecoinSuffixes) {
    if (withoutPrefix.endsWith(suffix)) {
      return suffix;
    }
  }

  if (withoutPrefix.length >= 6) {
    return withoutPrefix.slice(-3);
  }

  return null;
};

const inferQuoteCurrency = (entry: FinnhubSearchEntry): string => {
  const candidates = [
    entry.currency,
    extractQuoteFromSymbol(entry.displaySymbol),
    extractQuoteFromSymbol(entry.symbol),
    extractQuoteFromSymbol(entry.description),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeQuoteCurrency(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "USD";
};

const mapSearchResult = (entry: FinnhubSearchEntry): SymbolSearchResult | null => {
  const ticker = normalizeTicker(entry.symbol ?? entry.displaySymbol);

  if (!ticker) {
    return null;
  }

  const name = typeof entry.description === "string" && entry.description.trim().length > 0
    ? entry.description.trim()
    : ticker;

  const assetType = normalizeAssetType(entry.type);
  const quoteCurrency = inferQuoteCurrency(entry);

  return {
    ticker,
    name,
    assetType,
    quoteCurrency,
  } satisfies SymbolSearchResult;
};

const searchFinnhub = async (query: string): Promise<SymbolSearchResult[]> => {
  const apiKey = getFinnhubApiKey();
  const url = new URL(FINNHUB_SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
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

  const payload: FinnhubSearchResponse = await response.json();
  const results = filterAllowedFinnhubResults(payload.result ?? []);

  return results
    .map(mapSearchResult)
    .filter((entry): entry is SymbolSearchResult => Boolean(entry))
    .slice(0, 25);
};

export const handleSearchSymbols = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const isJson = req.headers.get("content-type")?.includes("application/json") ?? false;
    const payload: SearchRequest =
      req.method === "POST" && isJson ? await req.json() : {};

    const query = typeof payload.query === "string" ? payload.query.trim() : "";

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results = await searchFinnhub(query);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error in search-symbols:", err);
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
      JSON.stringify({ error: message, details: "Failed to search symbols" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

if (import.meta.main) {
  serve(handleSearchSymbols);
}
