import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { handleFetchStockPrice } from "./index.ts";

const createRequest = (body: Record<string, unknown>) =>
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

Deno.test("routes crypto asset types to the candle endpoint", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }>
    = [];

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    calls.push({ input });

    if (typeof input === "string" && input.includes("/crypto/candle")) {
      const payload = {
        s: "ok",
        c: [68000.12],
        h: [69001.54],
        l: [67010.34],
        v: [125.4],
        t: [1_710_950_400],
      };
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({
      ticker: "BINANCE:BTCUSDT",
      assetType: "CRYPTO",
    }));
    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.symbol, "BINANCE:BTCUSDT");
    assertEquals(result.price, 68000.12);
    assertEquals(result.high, 69001.54);
    assertEquals(result.low, 67010.34);
    assertEquals(result.provider, "finnhub");

    assertEquals(calls.length, 1);
    const url = new URL(
      typeof calls[0].input === "string" ? calls[0].input : calls[0].input.url,
    );
    assertEquals(url.pathname, "/api/v1/crypto/candle");
    assertEquals(url.searchParams.get("symbol"), "BINANCE:BTCUSDT");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("routes forex asset types to the candle endpoint", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }>
    = [];

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    calls.push({ input });

    if (typeof input === "string" && input.includes("/forex/candle")) {
      const payload = {
        s: "ok",
        c: [1.0852],
        h: [1.0865],
        l: [1.0821],
        v: [0],
        t: [1_710_950_400],
      };
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({
      ticker: "OANDA:EUR_USD",
      assetType: "FX",
    }));
    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.symbol, "OANDA:EUR_USD");
    assertEquals(result.price, 1.0852);
    assertEquals(result.provider, "finnhub");

    assertEquals(calls.length, 1);
    const url = new URL(
      typeof calls[0].input === "string" ? calls[0].input : calls[0].input.url,
    );
    assertEquals(url.pathname, "/api/v1/forex/candle");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("infers asset types from ticker symbols when missing", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: Request | string,
  ): Promise<Response> => {
    if (typeof input === "string" && input.includes("/crypto/candle")) {
      const payload = {
        s: "ok",
        c: [3200.25],
        h: [3250.0],
        l: [3100.5],
        v: [85.2],
        t: [1_710_950_400],
      };
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchStockPrice(createRequest({
      ticker: "BINANCE:ETHUSDT",
    }));
    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.symbol, "BINANCE:ETHUSDT");
    assertEquals(result.price, 3200.25);
    assertEquals(result.provider, "finnhub");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});
