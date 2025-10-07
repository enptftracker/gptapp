-- Create table to persist historical price series
CREATE TABLE IF NOT EXISTS public.historical_price_cache (
    symbol_id UUID REFERENCES public.symbols(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    price_currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (symbol_id, date)
);

ALTER TABLE public.historical_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view historical price cache" ON public.historical_price_cache
    FOR SELECT USING (true);

CREATE TRIGGER update_historical_price_cache_updated_at
    BEFORE UPDATE ON public.historical_price_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
