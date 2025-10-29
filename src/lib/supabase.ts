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
  asset_type: 'EQUITY' | 'ETF' | 'CRYPTO' | 'FUND' | 'FX';
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

export interface Profile {
  id: string;
  owner_id: string;
  base_currency: string;
  timezone: string;
  default_lot_method: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
  market_data_provider: 'alphavantage' | 'yfinance' | 'finnhub';
  created_at: string;
  updated_at: string;
}

export interface FxRate {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  asof: string;
  created_at: string;
}

export type BrokerageConnectionStatus =
  | 'pending'
  | 'active'
  | 'errored'
  | 'revoked'
  | 'requires_auth';

export interface BrokerageConnection {
  id: string;
  user_id: string;
  provider: string;
  status: BrokerageConnectionStatus;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  access_token_expires_at: string | null;
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerageAccount {
  id: string;
  connection_id: string;
  external_id: string | null;
  name: string | null;
  account_type: string | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokeragePosition {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  cost_basis: number | null;
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBrokerageConnectionInput {
  provider: string;
  status?: BrokerageConnectionStatus;
  metadata?: Record<string, unknown> | null;
  access_token_expires_at?: string | null;
  last_synced_at?: string | null;
}

export type UpdateBrokerageConnectionInput = Partial<
  Pick<BrokerageConnection, 'status' | 'metadata' | 'last_synced_at' | 'access_token_expires_at'>
>;

export interface CreateBrokerageAccountInput {
  connection_id: string;
  external_id?: string | null;
  name?: string | null;
  account_type?: string | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  last_synced_at?: string | null;
}

export type UpdateBrokerageAccountInput = Partial<
  Omit<BrokerageAccount, 'id' | 'connection_id' | 'created_at' | 'updated_at'>
>;

export interface CreateBrokeragePositionInput {
  account_id: string;
  symbol: string;
  quantity: number;
  cost_basis?: number | null;
  metadata?: Record<string, unknown> | null;
  last_synced_at?: string | null;
}

export type UpdateBrokeragePositionInput = Partial<
  Omit<BrokeragePosition, 'id' | 'account_id' | 'created_at' | 'updated_at'>
>;

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

export const fxRateService = {
  async getRelevantRates(baseCurrency: string, quoteCurrencies: string[]): Promise<FxRate[]> {
    const normalizedBase = (baseCurrency ?? 'USD').toUpperCase();
    const normalizedQuotes = Array.from(new Set(
      quoteCurrencies
        .map(currency => currency?.toUpperCase())
        .filter((currency): currency is string => Boolean(currency) && currency !== normalizedBase)
    ));

    if (normalizedQuotes.length === 0) {
      return [];
    }

    const currenciesToQuery = Array.from(new Set([normalizedBase, ...normalizedQuotes]));

    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .in('base_currency', currenciesToQuery)
      .in('quote_currency', currenciesToQuery)
      .order('asof', { ascending: false });

    if (error) throw error;

    const latestByPair = new Map<string, FxRate>();

    (data ?? []).forEach(rate => {
      const key = `${rate.base_currency.toUpperCase()}-${rate.quote_currency.toUpperCase()}`;
      if (!latestByPair.has(key)) {
        latestByPair.set(key, rate);
      }
    });

    return Array.from(latestByPair.values());
  },

  async saveRates(rates: Array<{ base_currency: string; quote_currency: string; rate: number; asof?: string | Date | null }>): Promise<void> {
    const payload = rates
      .map(rate => {
        if (typeof rate !== 'object' || rate === null) {
          return null;
        }

        const base = typeof rate.base_currency === 'string' ? rate.base_currency.trim().toUpperCase() : '';
        const quote = typeof rate.quote_currency === 'string' ? rate.quote_currency.trim().toUpperCase() : '';
        const numericRate = typeof rate.rate === 'number' ? rate.rate : Number.NaN;

        if (!base || !quote || !Number.isFinite(numericRate) || numericRate <= 0) {
          return null;
        }

        const asofValue = rate.asof instanceof Date
          ? rate.asof
          : typeof rate.asof === 'string'
            ? new Date(rate.asof)
            : null;

        const asof = asofValue && !Number.isNaN(asofValue.getTime())
          ? asofValue.toISOString()
          : new Date().toISOString();

        return {
          base_currency: base,
          quote_currency: quote,
          rate: numericRate,
          asof,
        };
      })
      .filter((entry): entry is { base_currency: string; quote_currency: string; rate: number; asof: string } => entry !== null);

    if (payload.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('fx_rates')
      .insert(payload);

    if (error) {
      throw error;
    }
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

const BROKERAGE_CONNECTION_COLUMNS = `
  id,
  user_id,
  provider,
  status,
  access_token_expires_at,
  metadata,
  last_synced_at,
  created_at,
  updated_at
`;

const BROKERAGE_ACCOUNT_COLUMNS = `
  id,
  connection_id,
  external_id,
  name,
  account_type,
  currency,
  metadata,
  last_synced_at,
  created_at,
  updated_at
`;

const BROKERAGE_POSITION_COLUMNS = `
  id,
  account_id,
  symbol,
  quantity,
  cost_basis,
  metadata,
  last_synced_at,
  created_at,
  updated_at
`;

export const brokerageConnectionService = {
  async list(): Promise<BrokerageConnection[]> {
    const { data, error } = await supabase
      .from('brokerage_connections')
      .select(BROKERAGE_CONNECTION_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async get(id: string): Promise<BrokerageConnection | null> {
    const { data, error } = await supabase
      .from('brokerage_connections')
      .select(BROKERAGE_CONNECTION_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(connection: CreateBrokerageConnectionInput): Promise<BrokerageConnection> {
    const userResponse = await supabase.auth.getUser();
    const userId = userResponse.data.user?.id;

    if (!userId) {
      throw new Error('User must be authenticated to create a brokerage connection.');
    }

    const { data, error } = await supabase
      .from('brokerage_connections')
      .insert({
        user_id: userId,
        provider: connection.provider,
        status: connection.status ?? 'pending',
        metadata: connection.metadata ?? {},
        access_token_expires_at: connection.access_token_expires_at ?? null,
        last_synced_at: connection.last_synced_at ?? null
      })
      .select(BROKERAGE_CONNECTION_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: UpdateBrokerageConnectionInput): Promise<BrokerageConnection> {
    const payload: Record<string, unknown> = {};

    if (typeof updates.status !== 'undefined') {
      payload.status = updates.status;
    }

    if (typeof updates.metadata !== 'undefined') {
      payload.metadata = updates.metadata ?? {};
    }

    if (typeof updates.access_token_expires_at !== 'undefined') {
      payload.access_token_expires_at = updates.access_token_expires_at;
    }

    if (typeof updates.last_synced_at !== 'undefined') {
      payload.last_synced_at = updates.last_synced_at;
    }

    const { data, error } = await supabase
      .from('brokerage_connections')
      .update(payload)
      .eq('id', id)
      .select(BROKERAGE_CONNECTION_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('brokerage_connections')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const brokerageAccountService = {
  async list(): Promise<BrokerageAccount[]> {
    const { data, error } = await supabase
      .from('brokerage_accounts')
      .select(BROKERAGE_ACCOUNT_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listByConnection(connectionId: string): Promise<BrokerageAccount[]> {
    const { data, error } = await supabase
      .from('brokerage_accounts')
      .select(BROKERAGE_ACCOUNT_COLUMNS)
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(account: CreateBrokerageAccountInput): Promise<BrokerageAccount> {
    const { data, error } = await supabase
      .from('brokerage_accounts')
      .insert({
        connection_id: account.connection_id,
        external_id: account.external_id ?? null,
        name: account.name ?? null,
        account_type: account.account_type ?? null,
        currency: account.currency ?? null,
        metadata: account.metadata ?? {},
        last_synced_at: account.last_synced_at ?? null
      })
      .select(BROKERAGE_ACCOUNT_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: UpdateBrokerageAccountInput): Promise<BrokerageAccount> {
    const payload: Record<string, unknown> = {};

    if (typeof updates.external_id !== 'undefined') {
      payload.external_id = updates.external_id;
    }

    if (typeof updates.name !== 'undefined') {
      payload.name = updates.name;
    }

    if (typeof updates.account_type !== 'undefined') {
      payload.account_type = updates.account_type;
    }

    if (typeof updates.currency !== 'undefined') {
      payload.currency = updates.currency;
    }

    if (typeof updates.metadata !== 'undefined') {
      payload.metadata = updates.metadata ?? {};
    }

    if (typeof updates.last_synced_at !== 'undefined') {
      payload.last_synced_at = updates.last_synced_at;
    }

    const { data, error } = await supabase
      .from('brokerage_accounts')
      .update(payload)
      .eq('id', id)
      .select(BROKERAGE_ACCOUNT_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('brokerage_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const brokeragePositionService = {
  async listByAccount(accountId: string): Promise<BrokeragePosition[]> {
    const { data, error } = await supabase
      .from('brokerage_positions')
      .select(BROKERAGE_POSITION_COLUMNS)
      .eq('account_id', accountId)
      .order('symbol');

    if (error) throw error;
    return data || [];
  },

  async listByAccounts(accountIds: string[]): Promise<BrokeragePosition[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('brokerage_positions')
      .select(BROKERAGE_POSITION_COLUMNS)
      .in('account_id', accountIds)
      .order('account_id')
      .order('symbol');

    if (error) throw error;
    return data || [];
  },

  async create(position: CreateBrokeragePositionInput): Promise<BrokeragePosition> {
    const { data, error } = await supabase
      .from('brokerage_positions')
      .insert({
        account_id: position.account_id,
        symbol: position.symbol,
        quantity: position.quantity,
        cost_basis: position.cost_basis ?? null,
        metadata: position.metadata ?? {},
        last_synced_at: position.last_synced_at ?? null
      })
      .select(BROKERAGE_POSITION_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: UpdateBrokeragePositionInput): Promise<BrokeragePosition> {
    const payload: Record<string, unknown> = {};

    if (typeof updates.symbol !== 'undefined') {
      payload.symbol = updates.symbol;
    }

    if (typeof updates.quantity !== 'undefined') {
      payload.quantity = updates.quantity;
    }

    if (typeof updates.cost_basis !== 'undefined') {
      payload.cost_basis = updates.cost_basis;
    }

    if (typeof updates.metadata !== 'undefined') {
      payload.metadata = updates.metadata ?? {};
    }

    if (typeof updates.last_synced_at !== 'undefined') {
      payload.last_synced_at = updates.last_synced_at;
    }

    const { data, error } = await supabase
      .from('brokerage_positions')
      .update(payload)
      .eq('id', id)
      .select(BROKERAGE_POSITION_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('brokerage_positions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
