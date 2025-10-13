ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS market_data_provider TEXT NOT NULL DEFAULT 'alphavantage';

ALTER TABLE public.profiles
ALTER COLUMN market_data_provider SET DEFAULT 'alphavantage';
