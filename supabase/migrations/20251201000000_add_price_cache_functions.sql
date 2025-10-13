-- Create helper functions to allow authenticated clients to refresh cached pricing data
CREATE OR REPLACE FUNCTION public.upsert_price_cache_entry(
    p_symbol_id UUID,
    p_price NUMERIC,
    p_price_currency TEXT DEFAULT 'USD',
    p_change_24h NUMERIC DEFAULT NULL,
    p_change_percent_24h NUMERIC DEFAULT NULL,
    p_asof TIMESTAMP WITH TIME ZONE DEFAULT now()
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.price_cache AS pc (
        symbol_id,
        price,
        price_currency,
        change_24h,
        change_percent_24h,
        asof
    ) VALUES (
        p_symbol_id,
        p_price,
        p_price_currency,
        p_change_24h,
        p_change_percent_24h,
        p_asof
    )
    ON CONFLICT (symbol_id)
    DO UPDATE SET
        price = EXCLUDED.price,
        price_currency = EXCLUDED.price_currency,
        change_24h = EXCLUDED.change_24h,
        change_percent_24h = EXCLUDED.change_percent_24h,
        asof = EXCLUDED.asof,
        created_at = pc.created_at,
        id = pc.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_price_cache_entry(
    UUID,
    NUMERIC,
    TEXT,
    NUMERIC,
    NUMERIC,
    TIMESTAMP WITH TIME ZONE
) TO authenticated;

-- Allow bulk persistence of historical price series from the client
CREATE OR REPLACE FUNCTION public.upsert_historical_price_cache(
    p_symbol_id UUID,
    p_points JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    upserted INTEGER;
BEGIN
    WITH payload AS (
        SELECT
            (point->>'date')::DATE AS date,
            (point->>'price')::NUMERIC(20,8) AS price,
            COALESCE(point->>'price_currency', 'USD') AS price_currency
        FROM jsonb_array_elements(p_points) AS point
        WHERE point ? 'date' AND point ? 'price'
    ),
    upsert AS (
        INSERT INTO public.historical_price_cache AS hpc (
            symbol_id,
            date,
            price,
            price_currency
        )
        SELECT
            p_symbol_id,
            payload.date,
            payload.price,
            payload.price_currency
        FROM payload
        ON CONFLICT (symbol_id, date)
        DO UPDATE SET
            price = EXCLUDED.price,
            price_currency = EXCLUDED.price_currency,
            updated_at = now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO upserted FROM upsert;

    RETURN COALESCE(upserted, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_historical_price_cache(UUID, JSONB) TO authenticated;
