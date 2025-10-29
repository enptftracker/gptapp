import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { handleFetchFxRate } from "./index.ts";

const createRequest = (body: unknown) =>
  new Request("http://localhost/fetch-fx-rate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("returns normalized FX rates for requested currencies", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }> = [];

  globalThis.fetch = (async (
    input: Request | string,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ input, init });

    if (typeof input === "string" && input.includes("finnhub.io")) {
      const payload = {
        base: "USD",
        date: "2024-04-01",
        quote: {
          CAD: 1.35,
          EURUSD: 1.1,
        },
      } satisfies Record<string, unknown>;

      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchFxRate(
      createRequest({ baseCurrency: "usd", quoteCurrencies: ["cad", "EUR"] }),
    );
    assertEquals(response.status, 200);

    const result = await response.json();
    assertEquals(result.base_currency, "USD");
    assertEquals(result.provider, "finnhub");
    assertEquals(result.rates.length, 2);

    const cadRate = result.rates.find((rate: any) => rate.base_currency === "CAD");
    const eurRate = result.rates.find((rate: any) => rate.base_currency === "EUR");

    assertEquals(cadRate.quote_currency, "USD");
    assertEquals(eurRate.quote_currency, "USD");
    // CAD quote is returned as USD->CAD, so expect inversion
    assertEquals(Number(cadRate.rate.toFixed(6)), Number((1 / 1.35).toFixed(6)));
    assertEquals(eurRate.rate, 1.1);
    assertMatch(cadRate.asof, /^2024-04-01/);

    assertEquals(calls.length, 1);
    const requestUrl =
      typeof calls[0].input === "string" ? calls[0].input : calls[0].input.url;
    const url = new URL(requestUrl);
    assertEquals(url.searchParams.get("token"), "test-token");
    assertEquals(url.searchParams.get("base"), "USD");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("returns 500 when Finnhub API key is missing", async () => {
  const response = await handleFetchFxRate(createRequest({ baseCurrency: "USD", quoteCurrencies: ["EUR"] }));
  assertEquals(response.status, 500);
  const payload = await response.json();
  assertMatch(payload.error, /api key/i);
});

Deno.test("returns 400 when request omits base currency", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const response = await handleFetchFxRate(createRequest({ quoteCurrencies: ["EUR"] }));
  assertEquals(response.status, 400);
  const payload = await response.json();
  assertMatch(payload.error, /base currency/i);
  Deno.env.delete("FINNHUB_API_KEY");
});
