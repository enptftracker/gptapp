import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface FxRateRequest {
  baseCurrency?: string;
  quoteCurrencies?: unknown;
}

interface FinnhubFxResponse {
  base?: string;
  date?: string;
  quote?: Record<string, unknown> | null;
  quotes?: Record<string, unknown> | null;
  rates?: Record<string, unknown> | null;
}

interface FxRatePayload {
  base_currency: string;
  quote_currency: string;
  rate: number;
  asof?: string;
}

const FINNHUB_FX_ENDPOINT = "https://finnhub.io/api/v1/forex/rates";

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

const normalizeCurrency = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toIsoDate = (value: unknown): string | undefined => {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

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

const selectQuoteMap = (
  payload: FinnhubFxResponse,
): Record<string, unknown> | null => {
  if (payload.quote && typeof payload.quote === "object") {
    return payload.quote;
  }

  if (payload.quotes && typeof payload.quotes === "object") {
    return payload.quotes;
  }

  if (payload.rates && typeof payload.rates === "object") {
    return payload.rates;
  }

  return null;
};

const extractRate = (
  quotes: Record<string, unknown>,
  baseCurrency: string,
  tradeCurrency: string,
): number | undefined => {
  const base = baseCurrency.toUpperCase();
  const trade = tradeCurrency.toUpperCase();

  const directKeys = [
    `${trade}${base}`,
    `${trade}/${base}`,
    `${trade}-${base}`,
    `${trade}:${base}`,
  ];

  for (const key of directKeys) {
    const rate = toFiniteNumber(quotes[key]);
    if (rate && rate > 0) {
      return rate;
    }
  }

  const inverseKeys = [
    `${base}${trade}`,
    `${base}/${trade}`,
    `${base}-${trade}`,
    `${base}:${trade}`,
    trade,
  ];

  for (const key of inverseKeys) {
    const value = toFiniteNumber(quotes[key]);
    if (value && value > 0) {
      return 1 / value;
    }
  }

  return undefined;
};

const fetchFinnhubRates = async (
  baseCurrency: string,
): Promise<{ base: string; asof?: string; rates: Record<string, unknown> } & { provider: "finnhub" }> => {
  const apiKey = getFinnhubApiKey();
  const url = new URL(FINNHUB_FX_ENDPOINT);
  url.searchParams.set("base", baseCurrency);
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

  const payload: FinnhubFxResponse = await response.json();

  const quoteMap = selectQuoteMap(payload);

  if (!quoteMap) {
    throw new HttpError(
      "Finnhub FX response is missing rates",
      502,
      payload,
    );
  }

  const upstreamBase = normalizeCurrency(payload.base) ?? baseCurrency;
  const asof = toIsoDate(payload.date);

  return { base: upstreamBase, asof, rates: quoteMap, provider: "finnhub" };
};

export const handleFetchFxRate = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const isJson =
      req.headers.get("content-type")?.includes("application/json") ?? false;
    const payload: FxRateRequest =
      req.method === "POST" && isJson ? await req.json() : {};

    const normalizedBase = normalizeCurrency(payload.baseCurrency);

    if (!normalizedBase) {
      return new Response(
        JSON.stringify({ error: "Base currency is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const requestedCurrencies = Array.isArray(payload.quoteCurrencies)
      ? payload.quoteCurrencies
        .map(normalizeCurrency)
        .filter((currency): currency is string => Boolean(currency) && currency !== normalizedBase)
      : [];

    const uniqueRequested = Array.from(new Set(requestedCurrencies));

    if (uniqueRequested.length === 0) {
      return new Response(
        JSON.stringify({
          base_currency: normalizedBase,
          rates: [] as FxRatePayload[],
          provider: "finnhub",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    console.log(
      `Fetching FX rates from Finnhub for ${normalizedBase} against ${uniqueRequested.join(",")}`,
    );

    const upstream = await fetchFinnhubRates(normalizedBase);
    const responseRates: FxRatePayload[] = [];

    for (const tradeCurrency of uniqueRequested) {
      const rate = extractRate(upstream.rates, upstream.base, tradeCurrency);
      if (!rate || rate <= 0) {
        continue;
      }

      responseRates.push({
        base_currency: tradeCurrency,
        quote_currency: upstream.base,
        rate,
        asof: upstream.asof ?? new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        base_currency: upstream.base,
        provider: upstream.provider,
        rates: responseRates,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err) {
    console.error("Error in fetch-fx-rate:", err);
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
      JSON.stringify({ error: message, details: "Failed to fetch FX rates" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

if (import.meta.main) {
  serve(handleFetchFxRate);
}
