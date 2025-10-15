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

## Supabase functions

Edge functions live in `supabase/functions`. Each function imports shared utilities from `_shared`. Deploy the latest changes by running:
```sh
supabase functions deploy <function-name>
```
When invoking from the frontend, use the helper exported by `src/integrations/supabase/env.ts` to resolve the correct function URL.

### External market data providers

The `fetch-stock-price` edge function first queries Alpha Vantage and automatically falls back to the Yahoo Finance quote API (`https://query1.finance.yahoo.com/v7/finance/quote`) when Alpha Vantage returns informational or rate limit responses. Yahoo Finance expects a descriptive `User-Agent` header; the function currently sends `PortfolioOpusSupabaseFunction/1.0`, which you can adjust to fit your deployment requirements.

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
