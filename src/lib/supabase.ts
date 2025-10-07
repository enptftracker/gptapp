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
  symbol?: Symbol;
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
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(portfolio: Omit<Portfolio, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<Portfolio> {
    const { data, error } = await supabase
      .from('portfolios')
      .insert({
        ...portfolio,
        owner_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Portfolio>): Promise<Portfolio> {
    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', id);
    
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

  async getMany(ids: string[]): Promise<Symbol[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('symbols')
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return data || [];
  },

  async create(symbol: Omit<Symbol, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<Symbol> {
    const { data, error } = await supabase
      .from('symbols')
      .insert({
        ...symbol,
        owner_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async findOrCreate(ticker: string, assetType: Symbol['asset_type'], quoteCurrency: string = 'USD'): Promise<Symbol> {
    // First try to find existing symbol
    const { data: existing } = await supabase
      .from('symbols')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
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
  async getAll(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        symbol:symbols(*)
      `)
      .order('trade_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getByPortfolio(portfolioId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        symbol:symbols(*)
      `)
      .eq('portfolio_id', portfolioId)
      .order('trade_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(transaction: Omit<Transaction, 'id' | 'owner_id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transaction,
        owner_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
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
      .order('asof', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getManyLatest(symbolIds: string[]): Promise<PriceData[]> {
    if (symbolIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('price_cache')
      .select('*')
      .in('symbol_id', symbolIds)
      .order('symbol_id', { ascending: true })
      .order('asof', { ascending: false });

    if (error) throw error;

    const seen = new Set<string>();
    const latest: PriceData[] = [];

    for (const price of data || []) {
      if (!seen.has(price.symbol_id)) {
        latest.push(price);
        seen.add(price.symbol_id);
      }
    }

    return latest;
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async update(updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};