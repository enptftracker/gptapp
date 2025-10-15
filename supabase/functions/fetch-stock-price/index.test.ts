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

Deno.test("returns Finnhub quote for valid ticker", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }>
    = [];

  globalThis.fetch = (async (
    input: Request | string,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ input, init });

    if (typeof input === "string" && input.includes("finnhub.io")) {
      const payload = {
        c: 173.21,
        d: 1.21,
        dp: 0.7,
        h: 174.12,
        l: 171.58,
        t: 1710950400,
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
    assertEquals(result.provider, "finnhub");

    assertEquals(calls.length, 1);
    const requestUrl =
      typeof calls[0].input === "string" ? calls[0].input : calls[0].input.url;
    const url = new URL(requestUrl);
    assertEquals(url.searchParams.get("token"), "test-token");
    assertEquals(url.searchParams.get("symbol"), "AAPL");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("returns 404 when Finnhub returns no price", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    if (typeof input === "string" && input.includes("finnhub.io")) {
      const payload = { c: null };

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
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("returns 502 when Finnhub responds with server error", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    if (typeof input === "string" && input.includes("finnhub.io")) {
      return new Response("upstream error", { status: 503 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({ ticker: "AAPL" }));
    assertEquals(response.status, 502);
    const payload = await response.json();
    assertMatch(payload.error, /finnhub api error/i);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("returns 500 when Finnhub request throws", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
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
    Deno.env.delete("FINNHUB_API_KEY");
  }
});
