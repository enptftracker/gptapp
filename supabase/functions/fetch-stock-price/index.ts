import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface StockRequest {
  ticker: string;
}

serve(async (req: Request): Promise<Response> => {
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

    if (data["Global Quote"] && Object.keys(data["Global Quote"]).length > 0) {
      const quote = data["Global Quote"];
      const stockData = {
        symbol: ticker,
        price: parseFloat(quote["05. price"]),
        change: parseFloat(quote["09. change"]),
        changePercent: parseFloat(quote["10. change percent"]?.replace("%", "")),
        high: parseFloat(quote["03. high"]),
        low: parseFloat(quote["04. low"]),
        volume: parseInt(quote["06. volume"]),
        tradingDay: quote["07. latest trading day"],
      };

      return new Response(JSON.stringify(stockData), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
});
