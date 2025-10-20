# Portfolio Opus

Portfolio Opus is an investment operations workspace that brings together portfolio tracking, cash flow planning, and performance analytics. The web application is built with Vite, React, TypeScript, and Tailwind CSS, and integrates directly with Supabase for authentication, data storage, and edge functions.

## Project structure

- **src/** – React application code, feature modules, and reusable UI components.
- **supabase/** – Database schema migrations and edge functions that power authenticated API access.
- **public/** – Static assets served with the application shell defined in `index.html`.

## Local workflow

1. **Install dependencies**
   ```sh
   npm install
   ```
2. **Configure environment** – Copy your Supabase credentials into a `.env.local` file. At minimum you need:
   ```ini
   VITE_SUPABASE_URL=<your-project-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   VITE_SUPABASE_FUNCTION_URL=<optional-custom-functions-url>
   ```
3. **Start Supabase (optional for local edge functions)** – If you need to run the Supabase functions locally, use the Supabase CLI:
   ```sh
   supabase start
   ```
4. **Run the app**
   ```sh
   npm run dev
   ```
   The development server listens on [http://localhost:5173](http://localhost:5173) and will automatically reload as files change.
5. **Lint and test before committing**
   ```sh
   npm run lint
   npm run test
   ```

   Supabase edge functions run on Deno. To exercise the `fetch-stock-price`
   fallback logic locally you can execute the dedicated test suite:
   ```sh
   deno test --allow-env supabase/functions/fetch-stock-price/index.test.ts
   ```

## Supabase functions

Edge functions live in `supabase/functions`. Each function imports shared utilities from `_shared`. Deploy the latest changes by running:
```sh
supabase functions deploy <function-name>
```
When invoking from the frontend, use the helper exported by `src/integrations/supabase/env.ts` to resolve the correct function URL.

### Scheduled brokerage refresh

Brokerage connections are refreshed automatically by the `brokerage-refresh` edge function. A Supabase Cron job triggers the function hourly, refreshes expiring OAuth tokens, and invokes the existing `brokerage-sync` routine to pull the latest holdings.

1. Define the following environment variables for the Supabase project:
   - `BROKERAGE_CRON_SECRET` – shared secret verified by the cron job request.
   - `BROKER_OAUTH_TOKEN_URL`, `BROKER_CLIENT_ID`, `BROKER_CLIENT_SECRET` – OAuth credentials used when rotating access tokens.
   - Optional tuning knobs: `BROKERAGE_REFRESH_BATCH_SIZE` (connections processed per run), `BROKERAGE_REFRESH_DELAY_MS` (delay between sync calls), and `BROKERAGE_REFRESH_EXPIRY_BUFFER_SECONDS` (early refresh buffer).
2. Deploy `supabase/functions/brokerage-refresh` and ensure the function's environment variables include `BROKERAGE_CRON_SECRET`.
3. Create the Cron job manually in Supabase:
   - **Dashboard:** Navigate to **Edge Functions → Cron**, add a job that targets `https://<project-ref>.functions.supabase.co/brokerage-refresh`, set the schedule to `0 * * * *`, and supply an `Authorization: Bearer ${BROKERAGE_CRON_SECRET}` header.
   - **HTTP API:** Use the [Supabase Management API](https://supabase.com/docs/guides/api/management-api#operation/createCronJob) to send a `POST` request with the same schedule, URL, and bearer token header.

During local development you can trigger the function manually without a Cron job:

```sh
supabase functions serve brokerage-refresh --env-file supabase/.env
```

With the function serving locally (usually on `http://127.0.0.1:54321/functions/v1/brokerage-refresh`), send a request that includes the bearer secret:

```sh
curl -X POST \
  -H "Authorization: Bearer ${BROKERAGE_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:54321/functions/v1/brokerage-refresh
```

### External market data providers

The `fetch-stock-price` edge function now queries the Finnhub quote API (`https://finnhub.io/api/v1/quote`) for live prices. Configure a `FINNHUB_API_KEY` environment variable in the Supabase function so the edge runtime can authenticate each request. Finnhub responses include the latest price (`c`), daily change (`d`), percent change (`dp`), and trading day timestamp (`t`), all of which the function normalizes before returning to the frontend.

## Deployment

Portfolio Opus is optimized for deployment on Vercel:

1. Push the latest code to the main branch.
2. Ensure the following environment variables are configured in your Vercel project:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTION_URL` (if different from the default Supabase value)
3. Trigger a Vercel deployment. The build step runs `npm install` and `npm run build`.
4. Deploy Supabase database migrations and functions using the Supabase CLI or dashboard to keep backend resources in sync.

## Continuous improvement

- Keep feature branches small and focused. Open a pull request once tests pass locally.
- Use the React Query Devtools and Supabase logs during development to validate data flows.
- Update documentation whenever you introduce a new environment variable, Supabase resource, or CLI workflow so the team can onboard quickly.
