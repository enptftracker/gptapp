# Security Review

## Summary
This review focuses on secrets management and Supabase Edge Function hardening for deployment on Vercel. The application primarily uses Supabase for data access and serverless functions for market data aggregation. The codebase now loads Supabase credentials from environment variables and enforces an explicit allow-list for Supabase Edge Function origins, so the remaining work concentrates on securely configuring those values in each environment.

## High Risk

- **Rotate Supabase keys that were previously committed.** Supabase URL and anon keys now resolve from `import.meta.env`, but earlier commits still expose project credentials. Rotate the anon key (and, if necessary, regenerate the project URL) before deploying to production. Update the regenerated values in Vercel/Vite environment variables only. 【F:src/integrations/supabase/client.ts†L1-L23】
- **Ensure required Supabase secrets exist in each runtime.** The Supabase Edge Function now fails fast if `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are missing. Define these in Supabase function secrets (locally via the Supabase CLI and in production via the dashboard) so the function can authenticate privileged writes and verify bearer tokens. 【F:supabase/functions/market-data/index.ts†L1-L39】

## Medium Risk

- **Configure the Supabase Edge Function CORS allow-list.** The shared CORS helper now requires `APP_ORIGIN` to be set and only authorizes requests from the configured comma-separated list. Populate this environment variable with your production domain and any Vercel preview URLs. Requests from other origins receive a 403 to reduce the temptation to fall back to `*`. 【F:supabase/functions/_shared/cors.ts†L1-L27】【F:supabase/functions/market-data/index.ts†L406-L432】

## Low Risk / Defense in Depth

- **Rate limiting and quota protections.** Authenticated users can trigger the `historical` and `batch_update` actions in `supabase/functions/market-data/index.ts`, which fan out to AlphaVantage and Yahoo Finance and write into privileged tables using the service role key. Although input validation and batching guards are present, consider adding per-user throttling (e.g., by checking a `rate_limits` table or caching a timestamp) to reduce the risk of abuse if a token is leaked. 【F:supabase/functions/market-data/index.ts†L509-L604】【F:supabase/functions/market-data/index.ts†L648-L684】

## Additional Recommendations

- Double-check Supabase Row Level Security in every environment after importing migrations. The provided SQL enables RLS and policies for the core tables, so ensure the migration set is applied before exposing the anon key. 【F:supabase/migrations/20250905132254_8e5daedd-90fb-4694-9de5-529cfe69bbb2.sql†L60-L130】
- Keep the Supabase service role key and third-party API keys (AlphaVantage) in Vercel's encrypted environment variables; never expose them client-side.
- Configure HTTPS-only cookies or use Supabase's PKCE flow if you later add server-side rendering to avoid leaking sessions in less trusted contexts.

## Deployment Checklist for Vercel

1. Copy `.env.example` to `.env` locally and populate every value. In Vercel, add the same variables to the project (Production, Preview, and Development environments):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `APP_ORIGIN` (set to your Vercel domain, e.g., `https://your-app.vercel.app`)
   - `ALPHAVANTAGE_API_KEY`
2. Rotate the existing anon key in Supabase after removing it from source control.
3. Test the Supabase Edge Function from your Vercel preview domain to confirm CORS and authentication headers succeed before promoting to production.

