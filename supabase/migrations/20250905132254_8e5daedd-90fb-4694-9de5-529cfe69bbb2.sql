-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE public.asset_type AS ENUM ('EQUITY', 'ETF', 'CRYPTO', 'FUND');
CREATE TYPE public.transaction_type AS ENUM ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'DIVIDEND', 'FEE');
CREATE TYPE public.lot_method AS ENUM ('FIFO', 'LIFO', 'HIFO', 'AVERAGE');

-- Create profiles table for user settings
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    default_lot_method lot_method NOT NULL DEFAULT 'FIFO',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create symbols table
CREATE TABLE public.symbols (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT,
    asset_type asset_type NOT NULL,
    exchange TEXT,
    quote_currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(owner_id, ticker, exchange)
);

-- Create portfolios table
CREATE TABLE public.portfolios (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
    symbol_id UUID REFERENCES public.symbols(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
    unit_price DECIMAL(20,8) NOT NULL DEFAULT 0,
    fee DECIMAL(20,8) NOT NULL DEFAULT 0,
    fx_rate DECIMAL(20,8) NOT NULL DEFAULT 1,
    trade_currency TEXT NOT NULL DEFAULT 'USD',
    trade_date DATE NOT NULL,
    notes TEXT,
    lot_link UUID, -- For linking sells to specific buys
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lots table for tracking cost basis
CREATE TABLE public.lots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
    symbol_id UUID REFERENCES public.symbols(id) ON DELETE CASCADE NOT NULL,
    quantity_open DECIMAL(20,8) NOT NULL DEFAULT 0,
    unit_cost_base DECIMAL(20,8) NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    original_transaction_id UUID REFERENCES public.transactions(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price cache table
CREATE TABLE public.price_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol_id UUID REFERENCES public.symbols(id) ON DELETE CASCADE NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    price_currency TEXT NOT NULL,
    change_24h DECIMAL(20,8),
    change_percent_24h DECIMAL(10,4),
    asof TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(symbol_id)
);

-- Create FX rates table
CREATE TABLE public.fx_rates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    rate DECIMAL(20,8) NOT NULL,
    asof DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(base_currency, quote_currency, asof)
);

-- Create watchlist table
CREATE TABLE public.watchlist (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symbol_id UUID REFERENCES public.symbols(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(owner_id, symbol_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own profile" ON public.profiles
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);

-- Create RLS policies for symbols
CREATE POLICY "Users can view their own symbols" ON public.symbols
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own symbols" ON public.symbols
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can update their own symbols" ON public.symbols
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can delete their own symbols" ON public.symbols
    FOR DELETE USING ((SELECT auth.uid()) = owner_id);

-- Create RLS policies for portfolios
CREATE POLICY "Users can view their own portfolios" ON public.portfolios
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own portfolios" ON public.portfolios
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can update their own portfolios" ON public.portfolios
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can delete their own portfolios" ON public.portfolios
    FOR DELETE USING ((SELECT auth.uid()) = owner_id);

-- Create RLS policies for transactions
CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own transactions" ON public.transactions
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can update their own transactions" ON public.transactions
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can delete their own transactions" ON public.transactions
    FOR DELETE USING ((SELECT auth.uid()) = owner_id);

-- Create RLS policies for lots
CREATE POLICY "Users can view their own lots" ON public.lots
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own lots" ON public.lots
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can update their own lots" ON public.lots
    FOR UPDATE USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can delete their own lots" ON public.lots
    FOR DELETE USING ((SELECT auth.uid()) = owner_id);

-- Create RLS policies for price_cache (read-only for users, updated by system)
CREATE POLICY "Users can view price cache" ON public.price_cache
    FOR SELECT USING (true);

-- Create RLS policies for fx_rates (read-only for users)
CREATE POLICY "Users can view fx rates" ON public.fx_rates
    FOR SELECT USING (true);

-- Create RLS policies for watchlist
CREATE POLICY "Users can view their own watchlist" ON public.watchlist
    FOR SELECT USING ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can create their own watchlist items" ON public.watchlist
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);
CREATE POLICY "Users can delete their own watchlist items" ON public.watchlist
    FOR DELETE USING ((SELECT auth.uid()) = owner_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_symbols_updated_at
    BEFORE UPDATE ON public.symbols
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at
    BEFORE UPDATE ON public.portfolios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lots_updated_at
    BEFORE UPDATE ON public.lots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (owner_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_symbols_owner_ticker ON public.symbols(owner_id, ticker);
CREATE INDEX idx_portfolios_owner ON public.portfolios(owner_id);
CREATE INDEX idx_transactions_portfolio ON public.transactions(portfolio_id);
CREATE INDEX idx_transactions_symbol ON public.transactions(symbol_id);
CREATE INDEX idx_transactions_date ON public.transactions(trade_date);
CREATE INDEX idx_lots_portfolio_symbol ON public.lots(portfolio_id, symbol_id);
CREATE INDEX idx_price_cache_symbol ON public.price_cache(symbol_id);
CREATE INDEX idx_fx_rates_currencies_date ON public.fx_rates(base_currency, quote_currency, asof);
CREATE INDEX idx_watchlist_owner ON public.watchlist(owner_id);