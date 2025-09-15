import { supabase } from '@/integrations/supabase/client';

export interface Portfolio {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Symbol {
  id: string;
  owner_id: string;
  ticker: string;
  name?: string;
  asset_type: 'EQUITY' | 'ETF' | 'CRYPTO' | 'FUND';
  exchange?: string;
  quote_currency: string;
  created_at: string;
  updated_at: string;
}

export interface SymbolWithPrice extends Symbol {
  price_cache?: PriceData | null;
}

export interface Transaction {
  id: string;
  owner_id: string;
  portfolio_id: string;
  symbol_id?: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'DIVIDEND' | 'FEE';
  quantity: number;
  unit_price: number;
  fee: number;
  fx_rate: number;
  trade_currency: string;
  trade_date: string;
  notes?: string;
  lot_link?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithSymbol extends Transaction {
  symbol?: SymbolWithPrice | null;
}

export interface PriceData {
  id: string;
  symbol_id: string;
  price: number;
  price_currency: string;
  change_24h?: number;
  change_percent_24h?: number;
  asof: string;
  created_at: string;
}

export interface Profile {
  id: string;
  owner_id: string;
  base_currency: string;
  timezone: string;
  default_lot_method: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
  created_at: string;
  updated_at: string;
}

// Portfolio operations
export const portfolioService = {
  async getAll(): Promise<Portfolio[]> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(portfolio: Omit<Portfolio, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<Portfolio> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('portfolios')
      .insert({
        ...portfolio,
        owner_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw error;
  }
};

// Symbol operations
export const symbolService = {
  async getAll(): Promise<Symbol[]> {
    const { data, error } = await supabase
      .from('symbols')
      .select('*')
      .order('ticker');
    
    if (error) throw error;
    return data || [];
  },

  async create(symbol: Omit<Symbol, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<Symbol> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('symbols')
      .insert({
        ...symbol,
        owner_id: user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async findOrCreate(ticker: string, assetType: Symbol['asset_type'], quoteCurrency: string = 'USD'): Promise<Symbol> {
    // First try to find existing symbol
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data: existing } = await supabase
      .from('symbols')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .eq('owner_id', user.id)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Create new symbol
    return this.create({
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(),
      asset_type: assetType,
      quote_currency: quoteCurrency
    });
  }
};

// Transaction operations
export const transactionService = {
  async getAll(): Promise<TransactionWithSymbol[]> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        symbol:symbol_id (
          id,
          owner_id,
          ticker,
          name,
          asset_type,
          exchange,
          quote_currency,
          price_cache (
            price,
            price_currency,
            change_24h,
            change_percent_24h,
            asof
          )
        )
      `)
      .eq('owner_id', user.id)
      .order('trade_date', { ascending: false });

    if (error) throw error;
    return (data as TransactionWithSymbol[]) || [];
  },

  async getByPortfolio(portfolioId: string): Promise<TransactionWithSymbol[]> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        symbol:symbol_id (
          id,
          owner_id,
          ticker,
          name,
          asset_type,
          exchange,
          quote_currency,
          price_cache (
            price,
            price_currency,
            change_24h,
            change_percent_24h,
            asof
          )
        )
      `)
      .eq('portfolio_id', portfolioId)
      .eq('owner_id', user.id)
      .order('trade_date', { ascending: false });

    if (error) throw error;
    return (data as TransactionWithSymbol[]) || [];
  },

  async create(transaction: Omit<Transaction, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<TransactionWithSymbol> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transaction,
        owner_id: user.id
      })
      .select(`
        *,
        symbol:symbol_id (
          id,
          owner_id,
          ticker,
          name,
          asset_type,
          exchange,
          quote_currency,
          price_cache (
            price,
            price_currency,
            change_24h,
            change_percent_24h,
            asof
          )
        )
      `)
      .single();

    if (error) throw error;
    return data as TransactionWithSymbol;
  },

  async update(id: string, updates: Partial<Omit<Transaction, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>): Promise<TransactionWithSymbol> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select(`
        *,
        symbol:symbol_id (
          id,
          owner_id,
          ticker,
          name,
          asset_type,
          exchange,
          quote_currency,
          price_cache (
            price,
            price_currency,
            change_24h,
            change_percent_24h,
            asof
          )
        )
      `)
      .single();

    if (error) throw error;
    return data as TransactionWithSymbol;
  },

  async delete(id: string): Promise<void> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw error;
  }
};

// Price operations
export const priceService = {
  async getLatest(symbolId: string): Promise<PriceData | null> {
    const { data, error } = await supabase
      .from('price_cache')
      .select('*')
      .eq('symbol_id', symbolId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async updatePrice(symbolId: string, price: number, currency: string = 'USD'): Promise<void> {
    const { error } = await supabase
      .from('price_cache')
      .upsert({
        symbol_id: symbolId,
        price,
        price_currency: currency,
        asof: new Date().toISOString()
      });
    
    if (error) throw error;
  }
};

// Profile operations
export const profileService = {
  async get(): Promise<Profile | null> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(updates: Partial<Profile>): Promise<Profile> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const existing = await this.get();

    const payload = {
      owner_id: user.id,
      base_currency: updates.base_currency ?? existing?.base_currency ?? 'USD',
      timezone: updates.timezone ?? existing?.timezone ?? 'UTC',
      default_lot_method: updates.default_lot_method ?? existing?.default_lot_method ?? 'FIFO',
    } as Partial<Profile> & { owner_id: string };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'owner_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
