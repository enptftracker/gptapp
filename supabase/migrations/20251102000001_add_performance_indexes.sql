-- Improve query performance with targeted indexes
-- These indexes align with frequent filters and ordering patterns
-- observed in the application layer.

-- Ensure ticker lookups remain efficient when searching by ticker alone.
CREATE INDEX IF NOT EXISTS idx_symbols_ticker ON public.symbols (ticker);

-- Speed up portfolio level transaction history queries ordered by trade date.
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_trade_date
  ON public.transactions (portfolio_id, trade_date DESC);

-- Support owner scoped transaction queries sorted by most recent trades.
CREATE INDEX IF NOT EXISTS idx_transactions_owner_trade_date
  ON public.transactions (owner_id, trade_date DESC);

-- Accelerate retrieval of open lots grouped by owner and portfolio.
CREATE INDEX IF NOT EXISTS idx_lots_owner_portfolio
  ON public.lots (owner_id, portfolio_id);

-- Optimize watchlist lookups per user with newest entries first.
CREATE INDEX IF NOT EXISTS idx_watchlist_owner_created_at
  ON public.watchlist (owner_id, created_at DESC);

-- Help price cache fetches for the most recent price per symbol.
CREATE INDEX IF NOT EXISTS idx_price_cache_symbol_asof_desc
  ON public.price_cache (symbol_id, asof DESC);
