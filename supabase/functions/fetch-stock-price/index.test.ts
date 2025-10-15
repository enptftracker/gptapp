import {
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

Deno.test("returns Yahoo Finance quote for valid ticker", async () => {
  Deno.env.set("YAHOO_USER_AGENT", "SupabaseTestAgent/1.0");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }>
    = [];

  globalThis.fetch = (async (
    input: Request | string,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ input, init });

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

    assertEquals(calls.length, 1);
    const headers = new Headers(calls[0].init?.headers);
    assertEquals(headers.get("User-Agent"), "SupabaseTestAgent/1.0");
    assertEquals(headers.get("Accept"), "application/json, text/javascript, */*; q=0.01");
    assertEquals(headers.get("Accept-Language"), "en-US,en;q=0.9");
    assertEquals(headers.get("Referer"), "https://finance.yahoo.com/");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("YAHOO_USER_AGENT");
  }
});

Deno.test("returns 404 when Yahoo returns no results", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    if (typeof input === "string" && input.includes("finance.yahoo.com")) {
      const payload = {
        quoteResponse: {
          result: [],
        },
      };

      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "ZZZZ" }));
    assertEquals(response.status, 404);
    const payload = await response.json();
    assertMatch(payload.error, /stock not found/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("returns 502 when Yahoo responds with server error", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    if (typeof input === "string" && input.includes("finance.yahoo.com")) {
      return new Response("upstream error", { status: 503 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 502);
    const payload = await response.json();
    assertMatch(payload.error, /yahoo finance api error/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("returns 500 when Yahoo request throws", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (): Promise<Response> => {
    throw new Error("Network failure");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 500);
    const payload = await response.json();
    assertMatch(payload.error, /network failure/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
