import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTION_URL } from '@/integrations/supabase/env';

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: Date;
  provider?: string;
}

export interface PriceUpdateErrorDetail {
  ticker: string;
  message: string;
}

export interface PriceUpdateSummary {
  provider: 'yahoo';
  totalSymbols: number;
  updated: number;
  failed: number;
  errors: PriceUpdateErrorDetail[];
  startedAt: Date;
  completedAt: Date;
}

export type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export interface HistoricalPricePoint {
  time: string;
  price: number;
}

interface QuoteResponse {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: string;
  provider?: string;
}

interface RefreshResponse {
  provider: 'yahoo';
  totalSymbols: number;
  updated: number;
  failed: number;
  errors?: PriceUpdateErrorDetail[];
  startedAt: string;
  completedAt: string;
}

interface HistoricalResponse {
  symbol: string;
  range: HistoricalRange;
  provider: 'yahoo';
  points?: HistoricalPricePoint[];
  error?: string;
}

class MarketDataAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataAuthorizationError';
  }
}

class MarketDataServiceImpl {
  private static async getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new MarketDataAuthorizationError('Unable to retrieve active session.');
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new MarketDataAuthorizationError('Please sign in to update market data.');
    }

    return token;
  }

  private static parseQuote(payload: QuoteResponse): LiveQuote {
    return {
      symbol: payload.symbol,
      price: Number(payload.price),
      change: Number(payload.change ?? 0),
      changePercent: Number(payload.changePercent ?? 0),
      volume: typeof payload.volume === 'number' ? payload.volume : undefined,
      marketCap: typeof payload.marketCap === 'number' ? payload.marketCap : undefined,
      lastUpdated: new Date(payload.lastUpdated),
      provider: payload.provider
    };
  }

  private static parseRefreshSummary(payload: RefreshResponse): PriceUpdateSummary {
    return {
      provider: 'yahoo',
      totalSymbols: Number(payload.totalSymbols ?? 0),
      updated: Number(payload.updated ?? 0),
      failed: Number(payload.failed ?? 0),
      errors: Array.isArray(payload.errors) ? payload.errors : [],
      startedAt: new Date(payload.startedAt),
      completedAt: new Date(payload.completedAt)
    };
  }

  private static async invokeFunction<T>(body: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${SUPABASE_FUNCTION_URL}/market-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let parsed: unknown = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        if (response.ok) {
          console.error('Market data response parsing failed:', error);
        }
      }
    }

    if (!response.ok) {
      const message = parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Market data request failed (${response.status}).`;
      throw new Error(message);
    }

    return parsed as T;
  }

  static async getMarketData(ticker: string): Promise<LiveQuote | null> {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    try {
      const payload = await this.invokeFunction<QuoteResponse>({ action: 'quote', symbol: normalized });
      return this.parseQuote(payload);
    } catch (error) {
      if (error instanceof MarketDataAuthorizationError) {
        throw error;
      }

      console.error('Live quote fetch failed, attempting to load cached data:', error);

      const { data: symbolRecord } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', normalized)
        .maybeSingle();

      if (!symbolRecord?.id) {
        return null;
      }

      const { data: cached } = await supabase
        .from('price_cache')
        .select('*')
        .eq('symbol_id', symbolRecord.id)
        .order('asof', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cached) {
        return null;
      }

      return {
        symbol: normalized,
        price: Number(cached.price),
        change: Number(cached.change_24h ?? 0),
        changePercent: Number(cached.change_percent_24h ?? 0),
        lastUpdated: new Date(cached.asof)
      };
    }
  }

  static async refreshPrices(tickers?: string[]): Promise<PriceUpdateSummary> {
    const normalized = Array.isArray(tickers)
      ? Array.from(new Set(
          tickers
            .map(ticker => ticker?.toString().trim().toUpperCase())
            .filter((ticker): ticker is string => Boolean(ticker))
        ))
      : [];

    const payload: Record<string, unknown> = { action: 'refresh_prices' };
    if (normalized.length) {
      payload.symbols = normalized;
    }

    const response = await this.invokeFunction<RefreshResponse>(payload);
    return this.parseRefreshSummary(response);
  }

  static async refreshAllPrices(): Promise<PriceUpdateSummary> {
    return this.refreshPrices();
  }

  static async updatePriceCache(_symbolId: string, ticker: string): Promise<void> {
    await this.refreshPrices([ticker]);
  }

  static async getHistoricalPrices(ticker: string, range: HistoricalRange): Promise<HistoricalPricePoint[]> {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    const payload = await this.invokeFunction<HistoricalResponse>({
      action: 'historical',
      symbol: normalized,
      range
    });

    if (payload.error) {
      throw new Error(payload.error);
    }

    return Array.isArray(payload.points) ? payload.points : [];
  }

  static async searchSymbols(query: string): Promise<Array<{ ticker: string; name: string; type: string }>> {
    const symbols = [
      { ticker: 'AAPL', name: 'Apple Inc.', type: 'EQUITY' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'EQUITY' },
      { ticker: 'GOOG', name: 'Alphabet Inc. Class A', type: 'EQUITY' },
      { ticker: 'TSLA', name: 'Tesla Inc.', type: 'EQUITY' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'EQUITY' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'EQUITY' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'EQUITY' },
      { ticker: 'META', name: 'Meta Platforms Inc.', type: 'EQUITY' },
      { ticker: 'NFLX', name: 'Netflix Inc.', type: 'EQUITY' },
      { ticker: 'JPM', name: 'JPMorgan Chase & Co.', type: 'EQUITY' },
      { ticker: 'BAC', name: 'Bank of America Corp', type: 'EQUITY' },
      { ticker: 'WFC', name: 'Wells Fargo & Company', type: 'EQUITY' },
      { ticker: 'JNJ', name: 'Johnson & Johnson', type: 'EQUITY' },
      { ticker: 'UNH', name: 'UnitedHealth Group Inc.', type: 'EQUITY' },
      { ticker: 'PFE', name: 'Pfizer Inc.', type: 'EQUITY' },
      { ticker: 'KO', name: 'The Coca-Cola Company', type: 'EQUITY' },
      { ticker: 'PEP', name: 'PepsiCo Inc.', type: 'EQUITY' },
      { ticker: 'WMT', name: 'Walmart Inc.', type: 'EQUITY' },
      { ticker: 'MCD', name: "McDonald's Corporation", type: 'EQUITY' },
      { ticker: 'DIS', name: 'The Walt Disney Company', type: 'EQUITY' },
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF' },
      { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF' },
      { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'ETF' },
      { ticker: 'IWM', name: 'iShares Russell 2000 ETF', type: 'ETF' },
      { ticker: 'EFA', name: 'iShares MSCI EAFE ETF', type: 'ETF' },
      { ticker: 'GLD', name: 'SPDR Gold Shares', type: 'ETF' },
      { ticker: 'SLV', name: 'iShares Silver Trust', type: 'ETF' },
      { ticker: 'ARKK', name: 'ARK Innovation ETF', type: 'ETF' },
      { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', type: 'ETF' },
      { ticker: 'XLF', name: 'Financial Select Sector SPDR Fund', type: 'ETF' },
      { ticker: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund', type: 'ETF' },
      { ticker: 'XLE', name: 'Energy Select Sector SPDR Fund', type: 'ETF' },
      { ticker: 'XLV', name: 'Health Care Select Sector SPDR Fund', type: 'ETF' },
      { ticker: 'BITO', name: 'ProShares Bitcoin Strategy ETF', type: 'ETF' },
      { ticker: 'VT', name: 'Vanguard Total World Stock ETF', type: 'ETF' },
      { ticker: 'BTC-USD', name: 'Bitcoin', type: 'CRYPTO' },
      { ticker: 'ETH-USD', name: 'Ethereum', type: 'CRYPTO' },
      { ticker: 'SOL-USD', name: 'Solana', type: 'CRYPTO' },
      { ticker: 'ADA-USD', name: 'Cardano', type: 'CRYPTO' },
      { ticker: 'DOGE-USD', name: 'Dogecoin', type: 'CRYPTO' },
      { ticker: 'BNB-USD', name: 'BNB', type: 'CRYPTO' },
      { ticker: 'MATIC-USD', name: 'Polygon', type: 'CRYPTO' },
      { ticker: 'COIN', name: 'Coinbase Global Inc.', type: 'EQUITY' },
      { ticker: 'MSTR', name: 'MicroStrategy Inc.', type: 'EQUITY' }
    ];

    const lowerQuery = query.toLowerCase();
    return symbols.filter(symbol =>
      symbol.ticker.toLowerCase().includes(lowerQuery) ||
      symbol.name.toLowerCase().includes(lowerQuery)
    );
  }
}

export const MarketDataService = MarketDataServiceImpl;
