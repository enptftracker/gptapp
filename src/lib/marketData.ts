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

export type MarketDataSource = 'alphavantage' | 'yfinance';

const YAHOO_RANGE_CONFIG: Record<HistoricalRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '15m' },
  '1W': { range: '5d', interval: '1h' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '5Y': { range: '5y', interval: '1mo' },
  'MAX': { range: 'max', interval: '3mo' }
};

export class MarketDataService {

  static readonly MAX_SYMBOLS_PER_BATCH = 20;
  static readonly DEFAULT_PROVIDER: MarketDataSource = 'alphavantage';
  static readonly PROVIDER_STORAGE_KEY = 'marketDataProvider';

  private static isEdgeDisabled(): boolean {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('disableMarketDataEdge');
      if (stored === 'true') {
        return true;
      }
    }

    try {
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_MARKET_DATA_EDGE === 'true') {
        return true;
      }
    } catch {
      // Ignore environments where import.meta is unavailable
    }

    return false;
  }

  private static getPreferredProvider(): MarketDataSource {
    if (typeof window === 'undefined') {
      return this.DEFAULT_PROVIDER;
    }

    const stored = window.localStorage.getItem(MarketDataService.PROVIDER_STORAGE_KEY);
    return stored === 'yfinance' ? 'yfinance' : 'alphavantage';
  }

  private static async invokeMarketData<T>(body: Record<string, unknown>): Promise<T | null> {
    if (this.isEdgeDisabled()) {
      console.warn('Supabase market-data edge disabled via configuration.');
      return null;
    }

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

    const provider = ((): MarketDataSource => {
      const candidate = (body as { provider?: unknown }).provider;
      if (typeof candidate === 'string') {
        return candidate === 'yfinance' ? 'yfinance' : 'alphavantage';
      }
      return this.getPreferredProvider();
    })();

    const payload = { ...body, provider };

    const { data, error } = await supabase.functions.invoke<T>('market-data', {
      body: payload,
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
      const message = typeof error === 'string'
        ? error
        : (error as { message?: string; error?: string }).message || (error as { message?: string; error?: string }).error;

      throw new Error(message || 'Failed to fetch market data from the edge function.');
    }

    return (data as T | null) ?? null;
  }

  /**
   * Get current market data for a symbol using real API
   */
  static async getMarketData(ticker: string): Promise<MarketDataProvider | null> {
    const normalizedTicker = ticker.trim().toUpperCase();
    try {
      // First try to get from cache
      const { data: symbolData } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', normalizedTicker)
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
      let data: MarketDataProvider | null = null;
      try {
        data = await this.invokeMarketData<MarketDataProvider>({ action: 'quote', symbol: normalizedTicker });
      } catch (error) {
        console.error('Edge quote fetch failed:', error);
      }

      if (data) {
        return data;
      }

      const fallback = await this.fetchYahooQuoteFallback(normalizedTicker);
      return fallback;
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

      await this.persistPriceCache(symbolId, marketData);
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

      const normalizedEntries = batchSymbols.map(symbol => ({
        symbolId: symbol.id,
        originalTicker: symbol.ticker,
        normalizedTicker: symbol.ticker.trim().toUpperCase()
      }));
      const statusByTicker = new Map<string, { success: boolean; error?: string }>();
      for (const entry of normalizedEntries) {
        statusByTicker.set(entry.normalizedTicker, { success: false });
      }

      let edgeError: unknown = null;
      let edgeData: {
        results?: Array<{ ticker?: string; symbol?: string; success?: boolean; status?: string; message?: string; error?: string }>;
      } | null = null;

      try {
        edgeData = await this.invokeMarketData<{
          results?: Array<{ ticker?: string; symbol?: string; success?: boolean; status?: string; message?: string; error?: string }>;
        }>({ action: 'batch_update', symbols: batchSymbols });
      } catch (error) {
        edgeError = error;
        console.error('Edge batch price update failed, falling back to direct quotes:', error);
      }

      if (edgeData) {
        const results = Array.isArray(edgeData.results) ? edgeData.results : [];
        if (results.length === 0) {
          for (const { normalizedTicker } of normalizedEntries) {
            statusByTicker.set(normalizedTicker, { success: true });
          }
        } else {
          const responded = new Set<string>();
          for (const result of results) {
            const normalizedTicker = (result.ticker ?? result.symbol ?? '').toString().toUpperCase();
            if (!normalizedTicker) {
              continue;
            }

            responded.add(normalizedTicker);
            const errorMessage = typeof result.error === 'string' ? result.error : undefined;
            const hasError =
              result.success === false ||
              result.status === 'error' ||
              !!result.error;

            if (hasError) {
              statusByTicker.set(normalizedTicker, {
                success: false,
                error: errorMessage || result.message || 'Unknown error occurred.'
              });
            } else {
              statusByTicker.set(normalizedTicker, { success: true });
            }
          }

          for (const { normalizedTicker } of normalizedEntries) {
            if (!responded.has(normalizedTicker)) {
              const existing = statusByTicker.get(normalizedTicker);
              if (!existing || existing.success) {
                statusByTicker.set(normalizedTicker, { success: true });
              }
            }
          }
        }
      } else {
        console.warn('Edge batch update unavailable; attempting direct Yahoo Finance fallback.');
        for (const { normalizedTicker } of normalizedEntries) {
          statusByTicker.set(normalizedTicker, {
            success: false,
            error: 'Missing authorization for batch update. Falling back to direct fetch.'
          });
        }
      }

      const fallbackTargets = normalizedEntries.filter(({ normalizedTicker }) => {
        const status = statusByTicker.get(normalizedTicker);
        return !status?.success;
      });

      if (fallbackTargets.length > 0) {
        const fallbackQuotes = await this.fetchYahooBatchQuotes(
          fallbackTargets.map(target => target.normalizedTicker)
        );

        for (const target of fallbackTargets) {
          const quote = fallbackQuotes.get(target.normalizedTicker);
          if (quote) {
            try {
              await this.persistPriceCache(target.symbolId, quote);
              statusByTicker.set(target.normalizedTicker, { success: true });
            } catch (persistError) {
              const message = persistError instanceof Error
                ? persistError.message
                : 'Unknown error while saving fallback quote.';
              statusByTicker.set(target.normalizedTicker, {
                success: false,
                error: message
              });
              console.error('Failed to persist fallback quote:', persistError);
            }
          } else {
            const existing = statusByTicker.get(target.normalizedTicker);
            statusByTicker.set(target.normalizedTicker, {
              success: false,
              error: existing?.error || 'Unable to fetch quote from Yahoo Finance.'
            });
          }
        }
      }

      const batchErrors: BatchUpdateErrorDetail[] = [];
      let batchSuccessCount = 0;

      for (const entry of normalizedEntries) {
        const status = statusByTicker.get(entry.normalizedTicker);
        if (status?.success) {
          batchSuccessCount += 1;
        } else {
          const edgeMessage = edgeError instanceof Error ? edgeError.message : undefined;
          const message = status?.error || edgeMessage || 'Unknown error occurred.';
          batchErrors.push({
            ticker: entry.originalTicker,
            message
          });
        }
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

    const summary: BatchUpdateSummary = {
      totalBatches,
      totalSymbols,
      successCount: cumulativeSuccessCount,
      errorCount: cumulativeErrorCount,
      errors,
      batches
    };

    if (totalSymbols > 0 && summary.successCount === 0) {
      throw new Error(summary.errors[0]?.message || 'Failed to update prices. Please try again later.');
    }

    return summary;
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

      let remoteSeries: HistoricalPricePoint[] | null = null;

      try {
        const fallback = await this.invokeMarketData<{ points?: HistoricalPricePoint[] }>({
          action: 'historical_range',
          symbol: normalizedTicker,
          range
        });

        if (fallback && Array.isArray(fallback.points)) {
          remoteSeries = fallback.points.map(point => ({
            time: point.time,
            price: Number(point.price)
          }));
        }
      } catch (edgeError) {
        console.error('Edge historical fetch failed:', edgeError);
      }

      if (remoteSeries && remoteSeries.length) {
        return remoteSeries;
      }

      const yahooSeries = await this.fetchYahooHistoricalRange(normalizedTicker, range);

      if (yahooSeries.length) {
        return yahooSeries;
      }

      throw new Error('Unable to fetch historical prices. Please reauthenticate and try again.');
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      throw error instanceof Error
        ? error
        : new Error('An unknown error occurred while fetching historical prices.');
    }
  }

  private static async persistPriceCache(symbolId: string, marketData: MarketDataProvider): Promise<void> {
    const lastUpdated = marketData.lastUpdated instanceof Date
      ? marketData.lastUpdated
      : new Date(marketData.lastUpdated ?? Date.now());

    const price = Number(marketData.price);
    const change = Number(marketData.change);
    const changePercent = Number(marketData.changePercent);

    const payload = {
      symbol_id: symbolId,
      price: Number.isFinite(price) ? price : 0,
      price_currency: 'USD',
      change_24h: Number.isFinite(change) ? change : 0,
      change_percent_24h: Number.isFinite(changePercent) ? changePercent : 0,
      asof: lastUpdated.toISOString()
    };

    const { error } = await supabase
      .from('price_cache')
      .upsert(payload, {
        onConflict: 'symbol_id'
      });

    if (error) {
      throw new Error(error.message || 'Failed to persist price cache record.');
    }
  }

  private static async fetchYahooBatchQuotes(tickers: string[]): Promise<Map<string, MarketDataProvider>> {
    const uniqueTickers = Array.from(
      new Set(
        tickers
          .map(ticker => ticker.trim().toUpperCase())
          .filter((ticker): ticker is string => Boolean(ticker))
      )
    );

    if (uniqueTickers.length === 0) {
      return new Map();
    }

    const results = await Promise.all(
      uniqueTickers.map(async (ticker) => {
        const quote = await this.fetchYahooQuoteFallback(ticker);
        return { ticker, quote } as const;
      })
    );

    const map = new Map<string, MarketDataProvider>();
    for (const { ticker, quote } of results) {
      if (quote) {
        map.set(ticker, quote);
      }
    }

    return map;
  }

  private static async fetchYahooQuoteFallback(ticker: string): Promise<MarketDataProvider | null> {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      );

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const result = payload?.chart?.result?.[0];
      const meta = result?.meta;

      if (!result || !meta) {
        return null;
      }

      const price = Number(meta.regularMarketPrice ?? meta.previousClose);
      const previousClose = Number(meta.previousClose ?? price);

      if (!Number.isFinite(price)) {
        return null;
      }

      const change = Number.isFinite(previousClose) ? price - previousClose : 0;
      const changePercent = Number.isFinite(previousClose) && previousClose !== 0
        ? (change / previousClose) * 100
        : 0;

      return {
        symbol: ticker,
        price,
        change,
        changePercent,
        volume: typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : undefined,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Yahoo fallback quote error:', error);
      return null;
    }
  }

  private static async fetchYahooHistoricalRange(ticker: string, range: HistoricalRange): Promise<HistoricalPricePoint[]> {
    try {
      const config = YAHOO_RANGE_CONFIG[range];
      if (!config) {
        return [];
      }

      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${config.range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`
      );

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      const result = payload?.chart?.result?.[0];

      if (!result) {
        return [];
      }

      const timestamps: Array<number | null> | undefined = result.timestamp;
      const quoteSeries: Array<number | null> | undefined = result.indicators?.quote?.[0]?.close;
      const adjCloseSeries: Array<number | null> | undefined = result.indicators?.adjclose?.[0]?.adjclose;

      const series = quoteSeries && quoteSeries.some(value => typeof value === 'number')
        ? quoteSeries
        : adjCloseSeries;

      if (!Array.isArray(timestamps) || !Array.isArray(series)) {
        return [];
      }

      const points: HistoricalPricePoint[] = [];

      timestamps.forEach((timestamp, index) => {
        if (typeof timestamp !== 'number') {
          return;
        }

        const price = series[index];
        if (typeof price !== 'number' || Number.isNaN(price)) {
          return;
        }

        points.push({
          time: new Date(timestamp * 1000).toISOString(),
          price: Number(price.toFixed(4))
        });
      });

      return points;
    } catch (error) {
      console.error('Yahoo fallback historical error:', error);
      return [];
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
      // Major equities
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
      { ticker: 'MCD', name: 'McDonald\'s Corporation', type: 'EQUITY' },
      { ticker: 'DIS', name: 'The Walt Disney Company', type: 'EQUITY' },

      // Sector and thematic ETFs
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

      // Cryptocurrencies
      { ticker: 'BTC-USD', name: 'Bitcoin', type: 'CRYPTO' },
      { ticker: 'ETH-USD', name: 'Ethereum', type: 'CRYPTO' },
      { ticker: 'SOL-USD', name: 'Solana', type: 'CRYPTO' },
      { ticker: 'ADA-USD', name: 'Cardano', type: 'CRYPTO' },
      { ticker: 'DOGE-USD', name: 'Dogecoin', type: 'CRYPTO' },
      { ticker: 'BNB-USD', name: 'BNB', type: 'CRYPTO' },
      { ticker: 'MATIC-USD', name: 'Polygon', type: 'CRYPTO' },

      // Crypto-related equities
      { ticker: 'COIN', name: 'Coinbase Global Inc.', type: 'EQUITY' },
      { ticker: 'MSTR', name: 'MicroStrategy Inc.', type: 'EQUITY' },
    ];

    const lowerQuery = query.toLowerCase();
    return symbols.filter(symbol => 
      symbol.ticker.toLowerCase().includes(lowerQuery) ||
      symbol.name.toLowerCase().includes(lowerQuery)
    );
  }
}