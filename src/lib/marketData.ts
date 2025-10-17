import { supabase } from '@/integrations/supabase/client';

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

export type HistoricalRange = '1D' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';

export interface HistoricalPricePoint {
  time: string;
  timestamp: number;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

type FetchStockPriceResponse = {
  symbol?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
  tradingDay?: string;
  provider?: string;
};

type HistoricalEntry = {
  timestamp?: number;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

type FetchHistoricalDataResponse = {
  symbol?: string;
  period?: string;
  resolution?: string;
  data?: HistoricalEntry[];
};

class MarketDataServiceImpl {
  static readonly PROVIDER_STORAGE_KEY = 'market-data-provider';

  private static normalizeTicker(ticker: string): string | null {
    const normalized = ticker.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  private static toNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private static round(value: number, digits = 4): number {
    return Number.parseFloat(value.toFixed(digits));
  }

  private static async fetchStockPrice(
    ticker: string
  ): Promise<FetchStockPriceResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke<FetchStockPriceResponse>(
        'fetch-stock-price',
        {
          body: { ticker }
        }
      );

      if (error) {
        throw error;
      }

      if (!data || typeof data !== 'object') {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching stock price:', error);
      throw error instanceof Error
        ? error
        : new Error('Unknown error fetching stock price.');
    }
  }

  private static async fetchHistoricalData(
    ticker: string,
    range: HistoricalRange
  ): Promise<FetchHistoricalDataResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke<FetchHistoricalDataResponse>(
        'fetch-historical-data',
        {
          body: { ticker, period: range }
        }
      );

      if (error) {
        throw error;
      }

      if (!data || typeof data !== 'object') {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error instanceof Error
        ? error
        : new Error('Unknown error fetching historical data.');
    }
  }

  private static parseTimestamp(entry: HistoricalEntry): number | null {
    if (typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)) {
      return entry.timestamp;
    }

    if (typeof entry.date === 'string') {
      const parsed = Date.parse(entry.date);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  static async getMarketData(ticker: string): Promise<LiveQuote | null> {
    const normalized = this.normalizeTicker(ticker);
    if (!normalized) {
      return null;
    }

    const data = await this.fetchStockPrice(normalized);

    if (!data) {
      return null;
    }

    const price = this.toNumber(data.price);

    if (typeof price !== 'number') {
      throw new Error('Supabase function returned an invalid price.');
    }

    const change = this.toNumber(data.change) ?? 0;
    const changePercent = this.toNumber(data.changePercent) ?? 0;
    const volume = this.toNumber(data.volume);
    const lastUpdated = data.tradingDay
      ? new Date(`${data.tradingDay}T00:00:00Z`)
      : new Date();

    return {
      symbol: data.symbol ?? normalized,
      price: this.round(price),
      change: this.round(change),
      changePercent: this.round(changePercent),
      volume: typeof volume === 'number' ? Math.round(volume) : undefined,
      lastUpdated,
      provider: data.provider ?? undefined
    };
  }

  static async getHistoricalPrices(
    ticker: string,
    range: HistoricalRange
  ): Promise<HistoricalPricePoint[]> {
    const normalized = this.normalizeTicker(ticker);
    if (!normalized) {
      return [];
    }

    const data = await this.fetchHistoricalData(normalized, range);

    if (!data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data
      .map((entry) => {
        const price = this.toNumber(entry.close);
        const timestamp = this.parseTimestamp(entry);

        if (typeof price !== 'number' || timestamp === null) {
          return null;
        }

        const open = this.toNumber(entry.open);
        const high = this.toNumber(entry.high);
        const low = this.toNumber(entry.low);
        const volume = this.toNumber(entry.volume);

        return {
          time: new Date(timestamp).toISOString(),
          timestamp,
          price: this.round(price),
          open: typeof open === 'number' ? this.round(open) : undefined,
          high: typeof high === 'number' ? this.round(high) : undefined,
          low: typeof low === 'number' ? this.round(low) : undefined,
          volume: typeof volume === 'number' ? Math.round(volume) : undefined,
        };
      })
      .filter((point): point is HistoricalPricePoint => point !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
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
