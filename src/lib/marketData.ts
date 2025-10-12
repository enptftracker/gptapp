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

export interface BatchUpdateErrorDetail {
  ticker: string;
  message?: string;
}

export interface BatchUpdateBatchResult {
  index: number;
  symbols: string[];
  successCount: number;
  errorCount: number;
  errors: BatchUpdateErrorDetail[];
}

export interface BatchUpdateProgressState {
  currentBatch: number;
  totalBatches: number;
  successCount: number;
  errorCount: number;
  errors: BatchUpdateErrorDetail[];
}

export interface BatchUpdateSummary {
  totalBatches: number;
  totalSymbols: number;
  successCount: number;
  errorCount: number;
  errors: BatchUpdateErrorDetail[];
  batches: BatchUpdateBatchResult[];
}

export type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export interface HistoricalPricePoint {
  time: string;
  price: number;
}

export class MarketDataService {

  static readonly MAX_SYMBOLS_PER_BATCH = 20;

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
  static async batchUpdatePrices(
    symbols: Array<{ id: string; ticker: string }>,
    onProgress?: (progress: BatchUpdateProgressState) => void
  ): Promise<BatchUpdateSummary> {
    const batches: BatchUpdateBatchResult[] = [];
    const errors: BatchUpdateErrorDetail[] = [];
    const totalSymbols = symbols.length;
    const totalBatches = totalSymbols === 0
      ? 0
      : Math.ceil(totalSymbols / MarketDataService.MAX_SYMBOLS_PER_BATCH);

    let cumulativeSuccessCount = 0;
    let cumulativeErrorCount = 0;
    let currentBatchIndex = 0;

    for (let i = 0; i < symbols.length; i += MarketDataService.MAX_SYMBOLS_PER_BATCH) {
      const batchSymbols = symbols.slice(i, i + MarketDataService.MAX_SYMBOLS_PER_BATCH);
      currentBatchIndex += 1;

      const symbolLookup = new Map(batchSymbols.map(symbol => [symbol.ticker.toUpperCase(), symbol.ticker]));
      const batchErrors: BatchUpdateErrorDetail[] = [];
      let batchSuccessCount = 0;

      try {
        const data = await this.invokeMarketData<{
          results?: Array<{ ticker?: string; symbol?: string; success?: boolean; status?: string; message?: string; error?: string }>;
        }>({ action: 'batch_update', symbols: batchSymbols });

        if (!data) {
          batchErrors.push(
            ...batchSymbols.map(symbol => ({
              ticker: symbol.ticker,
              message: 'Missing authorization for batch update.'
            }))
          );
        } else {
          const results = Array.isArray(data.results) ? data.results : [];
          if (results.length === 0) {
            batchSuccessCount = batchSymbols.length;
          } else {
            const responded = new Set<string>();
            for (const result of results) {
              const normalizedTicker = (result.ticker ?? result.symbol ?? '').toString().toUpperCase();
              const resolvedTicker = normalizedTicker ? symbolLookup.get(normalizedTicker) ?? normalizedTicker : '';
              if (normalizedTicker) {
                responded.add(normalizedTicker);
              }

              const errorMessage = typeof result.error === 'string' ? result.error : undefined;
              const hasError =
                result.success === false ||
                result.status === 'error' ||
                !!result.error;

              if (hasError) {
                batchErrors.push({
                  ticker: resolvedTicker || 'UNKNOWN',
                  message: errorMessage || result.message || 'Unknown error occurred.'
                });
              } else if (normalizedTicker) {
                batchSuccessCount += 1;
              }
            }

            for (const [normalizedTicker] of symbolLookup) {
              if (!responded.has(normalizedTicker)) {
                batchSuccessCount += 1;
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error during batch update.';
        batchErrors.push(
          ...batchSymbols.map(symbol => ({
            ticker: symbol.ticker,
            message
          }))
        );
        console.error('Error in batch price update:', error);
      }

      cumulativeSuccessCount += batchSuccessCount;
      cumulativeErrorCount += batchErrors.length;
      errors.push(...batchErrors);

      const batchResult: BatchUpdateBatchResult = {
        index: currentBatchIndex,
        symbols: batchSymbols.map(symbol => symbol.ticker),
        successCount: batchSuccessCount,
        errorCount: batchErrors.length,
        errors: batchErrors
      };

      batches.push(batchResult);

      onProgress?.({
        currentBatch: currentBatchIndex,
        totalBatches,
        successCount: cumulativeSuccessCount,
        errorCount: cumulativeErrorCount,
        errors: [...errors]
      });
    }

    return {
      totalBatches,
      totalSymbols,
      successCount: cumulativeSuccessCount,
      errorCount: cumulativeErrorCount,
      errors,
      batches
    };
  }

  /**
   * Fetch historical data for major indices
   */
  static async fetchHistoricalData(symbols?: string[]): Promise<void> {
    try {
      const sanitizedSymbols = Array.isArray(symbols)
        ? Array.from(
            new Set(
              symbols
                .map(symbol => symbol?.trim().toUpperCase())
                .filter((symbol): symbol is string => Boolean(symbol))
            )
          )
        : undefined;

      const payload: Record<string, unknown> = { action: 'historical' };
      if (sanitizedSymbols?.length) {
        payload.symbols = sanitizedSymbols;
      }

      const data = await this.invokeMarketData<{ success?: boolean; message?: string; results?: unknown[] }>(payload);
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
    const normalizedTicker = ticker.trim().toUpperCase();

    try {
      const { data: symbolData } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', normalizedTicker)
        .maybeSingle();

      const lookbackDays = MarketDataService.getLookbackDays(range);
      const fromDate = lookbackDays
        ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
        : null;

      const fetchFromCache = async () => {
        if (!symbolData) {
          return [] as Array<{ date: string; price: number }>;
        }

        let query = supabase
          .from('historical_price_cache')
          .select('date, price')
          .eq('symbol_id', symbolData.id)
          .order('date', { ascending: true });

        if (fromDate) {
          query = query.gte('date', fromDate.toISOString().slice(0, 10));
        }

        const { data } = await query;
        return (data || []).map(entry => ({
          date: entry.date as string,
          price: Number(entry.price)
        }));
      };

      let cachedSeries = await fetchFromCache();

      const isCacheStale = (() => {
        if (!cachedSeries.length) return true;
        const latest = cachedSeries[cachedSeries.length - 1];
        const latestDate = new Date(`${latest.date}T00:00:00Z`).getTime();
        const now = Date.now();
        const maxAgeMs = 1000 * 60 * 60 * 24 * 2; // 2 days
        return now - latestDate > maxAgeMs;
      })();

      if (isCacheStale && symbolData) {
        await MarketDataService.fetchHistoricalData([normalizedTicker]);
        cachedSeries = await fetchFromCache();
      }

      if (cachedSeries.length) {
        return cachedSeries.map(point => ({
          time: `${point.date}T00:00:00Z`,
          price: point.price
        }));
      }

      const fallback = await this.invokeMarketData<{ points?: HistoricalPricePoint[] }>({
        action: 'historical_range',
        symbol: normalizedTicker,
        range
      });

      if (!fallback || !Array.isArray(fallback.points)) {
        throw new Error('Unable to fetch historical prices. Please reauthenticate and try again.');
      }

      return fallback.points.map(point => ({
        time: point.time,
        price: Number(point.price)
      }));
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      throw error instanceof Error
        ? error
        : new Error('An unknown error occurred while fetching historical prices.');
    }
  }

  private static getLookbackDays(range: HistoricalRange): number | null {
    switch (range) {
      case '1D':
        return 2;
      case '1W':
        return 7;
      case '1M':
        return 31;
      case '3M':
        return 93;
      case '6M':
        return 186;
      case '1Y':
        return 366;
      case '5Y':
        return 365 * 5;
      case 'MAX':
      default:
        return null;
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