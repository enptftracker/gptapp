import { supabase } from '@/integrations/supabase/client';

export interface MarketDataProvider {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: Date;
}

export type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export interface HistoricalPricePoint {
  time: string;
  price: number;
}

export class MarketDataService {

  private static async invokeMarketData<T>(body: Record<string, unknown>): Promise<T | null> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Unable to retrieve session for market data request:', sessionError);
      return null;
    }
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      console.warn('No active session found. Skipping market data request.');
      return null;
    }

    const { data, error } = await supabase.functions.invoke<T>('market-data', {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const status = (error as { status?: number } | null)?.status;
    if (status === 401) {
      console.warn('Market data request returned 401. Please reauthenticate.');
      return null;
    }

    if (error) {
      throw error;
    }

    return (data as T | null) ?? null;
  }

  /**
   * Get current market data for a symbol using real API
   */
  static async getMarketData(ticker: string): Promise<MarketDataProvider | null> {
    try {
      // First try to get from cache
      const { data: symbolData } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', ticker.toUpperCase())
        .single();

      if (symbolData) {
        const { data: priceData } = await supabase
          .from('price_cache')
          .select('*')
          .eq('symbol_id', symbolData.id)
          .order('asof', { ascending: false })
          .limit(1)
          .single();

        if (priceData) {
          return {
            symbol: ticker.toUpperCase(),
            price: Number(priceData.price),
            change: Number(priceData.change_24h || 0),
            changePercent: Number(priceData.change_percent_24h || 0),
            lastUpdated: new Date(priceData.asof)
          };
        }
      }

      // If no cached data, fetch from API
      const data = await this.invokeMarketData<MarketDataProvider>({ action: 'quote', symbol: ticker });
      if (!data) return null;
      return data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      return null;
    }
  }

  /**
   * Update price cache in database
   */
  static async updatePriceCache(symbolId: string, ticker: string): Promise<void> {
    try {
      const marketData = await this.getMarketData(ticker);
      if (!marketData) return;

      // Update price_cache table
      const { error } = await supabase
        .from('price_cache')
        .upsert({
          symbol_id: symbolId,
          price: marketData.price,
          price_currency: 'USD',
          change_24h: marketData.change,
          change_percent_24h: marketData.changePercent,
          asof: new Date().toISOString()
        }, {
          onConflict: 'symbol_id'
        });

      if (error) {
        console.error('Error updating price cache:', error);
      }
    } catch (error) {
      console.error('Error in updatePriceCache:', error);
    }
  }

  /**
   * Batch update prices for multiple symbols using real API
   */
  static async batchUpdatePrices(symbols: Array<{ id: string; ticker: string }>): Promise<void> {
    try {
      const data = await this.invokeMarketData<{ results: unknown[] }>({ action: 'batch_update', symbols });
      if (!data) {
        console.warn('Batch update skipped due to missing authorization.');
        return;
      }

      console.log('Batch update results:', data);
    } catch (error) {
      console.error('Error in batch price update:', error);
    }
  }

  /**
   * Fetch historical data for major indices
   */
  static async fetchHistoricalData(): Promise<void> {
    try {
      const data = await this.invokeMarketData<{ success: boolean; message: string }>({ action: 'historical' });
      if (!data) {
        console.warn('Historical data fetch skipped due to missing authorization.');
        return;
      }

      console.log('Historical data fetch result:', data);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  }

  /**
   * Retrieve historical pricing data for a ticker and range.
   */
  static async getHistoricalPrices(ticker: string, range: HistoricalRange): Promise<HistoricalPricePoint[]> {
    try {
      const data = await this.invokeMarketData<{ points: HistoricalPricePoint[] }>({
        action: 'historical_range',
        symbol: ticker,
        range
      });

      if (!data?.points) {
        return [];
      }

      return data.points.map(point => ({
        time: point.time,
        price: Number(point.price)
      }));
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      return [];
    }
  }

  /**
   * Search symbols by ticker or name with expanded database
   */
  static async searchSymbols(query: string): Promise<Array<{ ticker: string; name: string; type: string }>> {
    // Enhanced symbol database with real symbols
    const symbols = [
      // Tech Stocks
      { ticker: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'STOCK' },
      { ticker: 'GOOG', name: 'Alphabet Inc. Class A', type: 'STOCK' },
      { ticker: 'TSLA', name: 'Tesla Inc.', type: 'STOCK' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'STOCK' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'STOCK' },
      { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'STOCK' },
      { ticker: 'META', name: 'Meta Platforms Inc.', type: 'STOCK' },
      { ticker: 'NFLX', name: 'Netflix Inc.', type: 'STOCK' },
      
      // Major ETFs
      { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF' },
      { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF' },
      { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'ETF' },
      { ticker: 'IWM', name: 'iShares Russell 2000 ETF', type: 'ETF' },
      { ticker: 'EFA', name: 'iShares MSCI EAFE ETF', type: 'ETF' },
      
      // Financial
      { ticker: 'JPM', name: 'JPMorgan Chase & Co.', type: 'STOCK' },
      { ticker: 'BAC', name: 'Bank of America Corp', type: 'STOCK' },
      { ticker: 'WFC', name: 'Wells Fargo & Company', type: 'STOCK' },
      
      // Healthcare
      { ticker: 'JNJ', name: 'Johnson & Johnson', type: 'STOCK' },
      { ticker: 'UNH', name: 'UnitedHealth Group Inc.', type: 'STOCK' },
      { ticker: 'PFE', name: 'Pfizer Inc.', type: 'STOCK' },
      
      // Consumer
      { ticker: 'KO', name: 'The Coca-Cola Company', type: 'STOCK' },
      { ticker: 'PEP', name: 'PepsiCo Inc.', type: 'STOCK' },
      { ticker: 'WMT', name: 'Walmart Inc.', type: 'STOCK' },
      
      // Crypto-related
      { ticker: 'COIN', name: 'Coinbase Global Inc.', type: 'STOCK' },
      { ticker: 'MSTR', name: 'MicroStrategy Inc.', type: 'STOCK' },
    ];

    const lowerQuery = query.toLowerCase();
    return symbols.filter(symbol => 
      symbol.ticker.toLowerCase().includes(lowerQuery) ||
      symbol.name.toLowerCase().includes(lowerQuery)
    );
  }
}