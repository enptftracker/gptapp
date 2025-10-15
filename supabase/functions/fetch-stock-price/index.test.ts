// Unit-level coverage for the fetch-stock-price edge function. These tests execute
// directly in Deno, mirroring the Supabase runtime, to assert the Alpha Vantage
// happy path and the Yahoo Finance fallback behaviour.
import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { handleFetchStockPrice } from "./index.ts";

const createRequest = (body: unknown) =>
  new Request("http://localhost/fetch-stock-price", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("returns Alpha Vantage quote when available", async () => {
  Deno.env.set("ALPHA_VANTAGE_API_KEY", "test-key");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: Request | string, init?: RequestInit): Promise<Response> => {
    calls.push({ input, init });

    if (typeof input === "string" && input.includes("alphavantage")) {
      const payload = {
        "Global Quote": {
          "01. symbol": "AAPL",
          "02. open": "170.0000",
          "03. high": "175.0000",
          "04. low": "168.0000",
          "05. price": "172.5700",
          "06. volume": "40234123",
          "07. latest trading day": "2024-03-20",
          "08. previous close": "170.2700",
          "09. change": "2.3000",
          "10. change percent": "1.3510%",
        },
      };

      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.symbol, "AAPL");
    assertEquals(result.price, 172.57);
    assertEquals(result.change, 2.3);
    assertEquals(result.changePercent, 1.351);
    assertEquals(result.tradingDay, "2024-03-20");
    assertEquals(result.provider, "alphavantage");
    assertEquals(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("falls back to Yahoo Finance when Alpha Vantage returns informational message", async () => {
  Deno.env.set("ALPHA_VANTAGE_API_KEY", "test-key");
  Deno.env.set("YAHOO_USER_AGENT", "SupabaseTestAgent/1.0");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: Request | string, init?: RequestInit): Promise<Response> => {
    calls.push({ input, init });

    if (typeof input === "string" && input.includes("alphavantage")) {
      return new Response(
        JSON.stringify({ Information: "Alpha Vantage is temporarily unavailable" }),
        { status: 200 },
      );
    }

    if (typeof input === "string" && input.includes("finance.yahoo.com")) {
      const payload = {
        quoteResponse: {
          result: [
            {
              symbol: "AAPL",
              regularMarketPrice: 173.21,
              regularMarketChange: 1.21,
              regularMarketChangePercent: 0.7,
              regularMarketDayHigh: 174.12,
              regularMarketDayLow: 171.58,
              regularMarketVolume: 38200341,
              regularMarketTime: 1710950400,
            },
          ],
        },
      };

      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 200);
    const result = await response.json();

    assertEquals(result.symbol, "AAPL");
    assertEquals(result.price, 173.21);
    assertEquals(result.change, 1.21);
    assertEquals(result.changePercent, 0.7);
    assertEquals(result.tradingDay, "2024-03-20");
    assertEquals(result.provider, "yfinance");

    assertEquals(calls.length, 2);
    const yahooCall = calls.find((call) =>
      typeof call.input === "string" && call.input.includes("finance.yahoo.com")
    );
    assert(yahooCall, "Expected Yahoo Finance fetch call to be recorded");
    const headers = new Headers(yahooCall.init?.headers);
    assertEquals(headers.get("User-Agent"), "SupabaseTestAgent/1.0");
    assertEquals(headers.get("Accept"), "application/json, text/javascript, */*; q=0.01");
    assertEquals(headers.get("Accept-Language"), "en-US,en;q=0.9");
    assertEquals(headers.get("Referer"), "https://finance.yahoo.com/");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("YAHOO_USER_AGENT");
  }
});

Deno.test("returns 503 when fallback to Yahoo Finance fails after informational response", async () => {
  Deno.env.set("ALPHA_VANTAGE_API_KEY", "test-key");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: Request | string): Promise<Response> => {
    if (typeof input === "string" && input.includes("alphavantage")) {
      return new Response(
        JSON.stringify({ Information: "Alpha Vantage is temporarily unavailable" }),
        { status: 200 },
      );
    }

    if (typeof input === "string" && input.includes("finance.yahoo.com")) {
      throw new Error("Yahoo unavailable");
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 503);
    const payload = await response.json();
    assertMatch(payload.error, /temporarily unavailable/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("returns 429 when fallback fails after Alpha Vantage rate limiting", async () => {
  Deno.env.set("ALPHA_VANTAGE_API_KEY", "test-key");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: Request | string): Promise<Response> => {
    if (typeof input === "string" && input.includes("alphavantage")) {
      return new Response(
        JSON.stringify({ Note: "Alpha Vantage rate limit exceeded" }),
        { status: 200 },
      );
    }

    if (typeof input === "string" && input.includes("finance.yahoo.com")) {
      throw new Error("Yahoo unavailable");
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 429);
    assertEquals(response.headers.get("Retry-After"), "60");
    const payload = await response.json();
    assertMatch(payload.error, /rate limit/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
