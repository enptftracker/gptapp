import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { handleFetchCompanyNews } from "./index.ts";

const createRequest = (body: unknown) =>
  new Request("http://localhost/fetch-company-news", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("returns normalized company news for valid ticker", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: Request | string; init?: RequestInit }> = [];

  globalThis.fetch = (async (
    input: Request | string,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ input, init });

    if (typeof input === "string" && input.includes("finnhub.io")) {
      const payload = [
        {
          datetime: 1710961200,
          headline: "Example Corp beats earnings expectations",
          summary: "Example Corp reported stronger than expected results.",
          source: "MarketWatch",
          url: "https://example.com/article",
          related: "EXMP",
        },
        {
          datetime: 1710874800,
          headline: "Example Corp announces new partnership",
          summary: "The company announced a new strategic partnership.",
          source: "Reuters",
          url: "https://example.com/article-2",
          related: "EXMP,PART",
        },
      ];

      return new Response(JSON.stringify(payload), { status: 200 });
    }

    throw new Error("Unexpected fetch call");
  }) as typeof fetch;

  try {
    const response = await handleFetchCompanyNews(
      createRequest({ ticker: "EXMP" }),
    );

    assertEquals(response.status, 200);
    const payload = await response.json();

    assertEquals(payload.symbol, "EXMP");
    assertEquals(payload.provider, "finnhub");
    assertEquals(payload.news.length, 2);

    const [first] = payload.news;
    assertEquals(first.title, "Example Corp beats earnings expectations");
    assertEquals(first.publisher, "MarketWatch");
    assertEquals(first.url, "https://example.com/article");
    assertEquals(first.summary,
      "Example Corp reported stronger than expected results.");
    assertEquals(first.sentiment, "positive");

    assertEquals(calls.length, 1);
    const requestUrl =
      typeof calls[0].input === "string" ? calls[0].input : calls[0].input.url;
    const url = new URL(requestUrl);
    assertEquals(url.searchParams.get("symbol"), "EXMP");
    assertEquals(url.searchParams.get("token"), "test-token");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("filters out news items not related to the requested ticker", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          datetime: 1710961200,
          headline: "Tesla and Ford expand charging partnership",
          related: "TSLA,F",
          url: "https://example.com/tesla-ford",
        },
        {
          datetime: 1710874800,
          headline: "Apple announces new product",
          related: "AAPL",
          url: "https://example.com/apple",
        },
        {
          datetime: 1710788400,
          headline: "Microsoft teams up with Tesla on AI",
          related: "MSFT, TSLA",
          url: "https://example.com/microsoft-tesla",
        },
      ]),
      { status: 200 },
    )) as typeof fetch;

  try {
    const response = await handleFetchCompanyNews(
      createRequest({ ticker: "tsla" }),
    );

    assertEquals(response.status, 200);
    const payload = await response.json();

    assertEquals(payload.symbol, "TSLA");
    assertEquals(payload.news.length, 2);
    const headlines = payload.news.map((item: { title: string }) => item.title);
    assertEquals(headlines, [
      "Tesla and Ford expand charging partnership",
      "Microsoft teams up with Tesla on AI",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});

Deno.test("returns 400 when ticker is missing", async () => {
  const response = await handleFetchCompanyNews(createRequest({}));
  assertEquals(response.status, 400);
  const payload = await response.json();
  assertMatch(payload.error, /ticker symbol is required/i);
});

Deno.test("returns upstream status code on Finnhub error", async () => {
  Deno.env.set("FINNHUB_API_KEY", "test-token");
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
    })) as typeof fetch;

  try {
    const response = await handleFetchCompanyNews(
      createRequest({ ticker: "EXMP" }),
    );

    assertEquals(response.status, 429);
    const payload = await response.json();
    assertMatch(payload.error, /finnhub api error/i);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("FINNHUB_API_KEY");
  }
});
