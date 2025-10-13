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

export interface PortfolioPriceUpdateSummary extends PriceUpdateSummary {
  portfolioId: string;
  quotes: LiveQuote[];
}

export type PriceUpdateSummaryLike = PriceUpdateSummary | PortfolioPriceUpdateSummary;

interface SymbolRecord {
  id: string;
  ticker: string;
}

const YAHOO_HISTORICAL_CONFIG: Record<HistoricalRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '30m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
  'MAX': { range: 'max', interval: '1mo' }
};

class MarketDataAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataAuthorizationError';
  }
}

class MarketDataServiceImpl {
  static readonly PROVIDER_STORAGE_KEY = 'market-data-provider';
  private static readonly YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

  private static async requireAuth(): Promise<void> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new MarketDataAuthorizationError('Unable to retrieve active session.');
    }

    const token = data.session?.access_token;
    if (!token) {
      throw new MarketDataAuthorizationError('Please sign in to update market data.');
    }
  }

  private static normalizeTickers(tickers?: string[]): string[] {
    if (!Array.isArray(tickers)) {
      return [];
    }

    return Array.from(new Set(
      tickers
        .map(ticker => ticker?.toString().trim().toUpperCase())
        .filter((ticker): ticker is string => Boolean(ticker))
    ));
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

  private static async fetchYahooQuote(symbol: string): Promise<LiveQuote> {
    const url = `${this.YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbol)}`;
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.error('Yahoo Finance quote request failed:', error);
      throw new Error('Unable to reach the market data provider.');
    }

    if (!response.ok) {
      throw new Error(`Yahoo Finance request failed (${response.status}).`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      console.error('Failed to parse Yahoo Finance quote response:', error);
      throw new Error('Yahoo Finance returned an invalid response.');
    }

    const result = (payload as { quoteResponse?: { result?: unknown[] } })?.quoteResponse?.result?.[0];

    if (!result) {
      throw new Error('Yahoo Finance returned no data for the requested symbol.');
    }

    const record = result as Record<string, unknown>;

    const priceCandidate = this.toNumber(
      record['regularMarketPrice'] ?? record['postMarketPrice'] ?? record['preMarketPrice']
    );

    if (typeof priceCandidate !== 'number') {
      throw new Error('Yahoo Finance returned an invalid price.');
    }

    const changeCandidate = this.toNumber(record['regularMarketChange']) ?? 0;
    const changePercentCandidate = this.toNumber(record['regularMarketChangePercent']) ?? 0;
    const volumeCandidate = this.toNumber(record['regularMarketVolume']);
    const marketCapCandidate = this.toNumber(record['marketCap']);

    const lastUpdatedSeconds = this.toNumber(
      record['regularMarketTime'] ?? record['postMarketTime'] ?? Date.now() / 1000
    );
    const lastUpdated = typeof lastUpdatedSeconds === 'number'
      ? new Date(lastUpdatedSeconds * 1000)
      : new Date();

    return {
      symbol,
      price: this.round(priceCandidate),
      change: this.round(changeCandidate),
      changePercent: this.round(changePercentCandidate),
      volume: typeof volumeCandidate === 'number' ? volumeCandidate : undefined,
      marketCap: typeof marketCapCandidate === 'number' ? marketCapCandidate : undefined,
      lastUpdated,
      provider: 'yahoo'
    };
  }

  private static async fetchYahooHistorical(symbol: string, range: HistoricalRange): Promise<HistoricalPricePoint[]> {
    const config = YAHOO_HISTORICAL_CONFIG[range];
    if (!config) {
      throw new Error('Invalid historical range supplied.');
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.interval}&includePrePost=false&events=div%2Csplits`;
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.error('Yahoo Finance historical request failed:', error);
      throw new Error('Unable to reach the market data provider.');
    }

    if (!response.ok) {
      throw new Error(`Yahoo Finance historical request failed (${response.status}).`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      console.error('Failed to parse Yahoo Finance historical response:', error);
      throw new Error('Yahoo Finance returned an invalid response.');
    }

    const result = (payload as { chart?: { result?: unknown[] } })?.chart?.result?.[0];

    if (!result) {
      throw new Error('Yahoo Finance returned no historical data.');
    }

    const record = result as Record<string, unknown>;
    const timestamps = Array.isArray(record['timestamp']) ? record['timestamp'] : [];
    const indicators = record['indicators'] as Record<string, unknown> | undefined;
    const quoteIndicator = indicators?.['quote'] as Array<Record<string, unknown>> | undefined;
    const adjIndicator = indicators?.['adjclose'] as Array<Record<string, unknown>> | undefined;
    const quoteSeries = Array.isArray(quoteIndicator?.[0]?.['close'])
      ? (quoteIndicator![0]!['close'] as Array<number | null>)
      : undefined;
    const adjSeries = Array.isArray(adjIndicator?.[0]?.['adjclose'])
      ? (adjIndicator![0]!['adjclose'] as Array<number | null>)
      : undefined;

    const series = Array.isArray(quoteSeries) && quoteSeries.some(value => typeof value === 'number')
      ? quoteSeries
      : adjSeries;

    if (!Array.isArray(series)) {
      throw new Error('Yahoo Finance returned incomplete historical data.');
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
        price: this.round(price)
      });
    });

    return points;
  }

  private static async persistQuote(symbolId: string, quote: LiveQuote): Promise<void> {
    const { error } = await supabase.rpc('upsert_price_cache_entry', {
      p_symbol_id: symbolId,
      p_price: quote.price,
      p_price_currency: 'USD',
      p_change_24h: quote.change,
      p_change_percent_24h: quote.changePercent,
      p_asof: quote.lastUpdated.toISOString()
    });

    if (error) {
      throw new Error(error.message ?? 'Failed to persist quote.');
    }
  }

  private static mapSymbolRecords(records: Array<{ id?: string | null; ticker?: string | null }> | null): SymbolRecord[] {
    return (records ?? [])
      .filter((record): record is { id: string; ticker: string } =>
        typeof record?.id === 'string' &&
        record.id.length > 0 &&
        typeof record?.ticker === 'string' &&
        record.ticker.length > 0
      )
      .map(record => ({
        id: record.id,
        ticker: record.ticker.toUpperCase()
      }));
  }

  private static async loadSymbolsByIds(ids: string[]): Promise<SymbolRecord[]> {
    if (!ids.length) {
      return [];
    }

    const { data, error } = await supabase
      .from('symbols')
      .select('id, ticker')
      .in('id', ids)
      .order('ticker');

    if (error) {
      console.error('Failed to load symbols by id:', error);
      throw new Error('Unable to load symbols for the current user.');
    }

    return this.mapSymbolRecords(data);
  }

  private static async loadSymbolsForTickers(tickers: string[]): Promise<{ symbols: SymbolRecord[]; missing: string[] }> {
    if (!tickers.length) {
      return { symbols: [], missing: [] };
    }

    const { data, error } = await supabase
      .from('symbols')
      .select('id, ticker')
      .in('ticker', tickers)
      .order('ticker');

    if (error) {
      console.error('Failed to load symbols for tickers:', error);
      throw new Error('Unable to load symbols for the current user.');
    }

    const symbols = this.mapSymbolRecords(data);
    const foundTickers = new Set(symbols.map(symbol => symbol.ticker.toUpperCase()));
    const missing = tickers.filter(ticker => !foundTickers.has(ticker.toUpperCase()));

    return { symbols, missing };
  }

  private static async loadSymbolsFromPositions(): Promise<SymbolRecord[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('symbol_id')
      .not('symbol_id', 'is', null);

    if (error) {
      console.error('Failed to load positions for price refresh:', error);
      throw new Error('Unable to load portfolio positions.');
    }

    const ids = Array.from(new Set(
      (data ?? [])
        .map(entry => (entry as { symbol_id?: string | null }).symbol_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ));

    return this.loadSymbolsByIds(ids);
  }

  private static async loadSymbolsForPortfolio(portfolioId: string): Promise<SymbolRecord[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('symbol_id')
      .eq('portfolio_id', portfolioId)
      .not('symbol_id', 'is', null);

    if (error) {
      console.error(`Failed to load symbols for portfolio ${portfolioId}:`, error);
      throw new Error('Unable to load portfolio symbols.');
    }

    const ids = Array.from(new Set(
      (data ?? [])
        .map(entry => (entry as { symbol_id?: string | null }).symbol_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ));

    return this.loadSymbolsByIds(ids);
  }

  private static async refreshQuotesForSymbols(
    symbols: SymbolRecord[],
    options?: { includeQuotes?: boolean; missingTickers?: string[] }
  ): Promise<{ summary: PriceUpdateSummary; quotes: LiveQuote[] }> {
    const startedAt = new Date();
    const errors: PriceUpdateErrorDetail[] = (options?.missingTickers ?? []).map(ticker => ({
      ticker,
      message: 'Symbol not found for current user.'
    }));
    const quotes: LiveQuote[] = [];
    let updated = 0;

    for (const symbol of symbols) {
      try {
        const quote = await this.fetchYahooQuote(symbol.ticker);
        await this.persistQuote(symbol.id, quote);
        updated += 1;
        if (options?.includeQuotes) {
          quotes.push(quote);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to refresh quote.';
        errors.push({ ticker: symbol.ticker, message });
        console.error(`Failed to refresh ${symbol.ticker}:`, message);
      }
    }

    const completedAt = new Date();

    const summary: PriceUpdateSummary = {
      provider: 'yahoo',
      totalSymbols: symbols.length,
      updated,
      failed: errors.length,
      errors,
      startedAt,
      completedAt
    };

    return { summary, quotes };
  }

  static async getMarketData(ticker: string): Promise<LiveQuote | null> {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    await this.requireAuth();

    const { data: symbolRecord, error: symbolError } = await supabase
      .from('symbols')
      .select('id')
      .eq('ticker', normalized)
      .maybeSingle();

    if (symbolError) {
      console.error(`Failed to load symbol record for ${normalized}:`, symbolError);
    }

    try {
      const quote = await this.fetchYahooQuote(normalized);

      if (symbolRecord?.id) {
        try {
          await this.persistQuote(symbolRecord.id, quote);
        } catch (persistError) {
          console.warn(`Failed to persist quote for ${normalized}:`, persistError);
        }
      }

      return quote;
    } catch (error) {
      if (error instanceof MarketDataAuthorizationError) {
        throw error;
      }

      console.error('Live quote fetch failed, attempting to load cached data:', error);

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
    await this.requireAuth();

    const normalized = this.normalizeTickers(tickers);
    if (normalized.length) {
      const { symbols, missing } = await this.loadSymbolsForTickers(normalized);
      const { summary } = await this.refreshQuotesForSymbols(symbols, { missingTickers: missing });
      return summary;
    }

    const symbols = await this.loadSymbolsFromPositions();
    const { summary } = await this.refreshQuotesForSymbols(symbols);
    return summary;
  }

  static async refreshAllPrices(): Promise<PriceUpdateSummary> {
    return this.refreshPrices();
  }

  static async updatePriceCache(_symbolId: string, ticker: string): Promise<void> {
    await this.refreshPrices([ticker]);
  }

  static async refreshPortfolioPrices(portfolioId: string): Promise<PortfolioPriceUpdateSummary> {
    const normalized = portfolioId.trim();
    if (!normalized) {
      throw new Error('Portfolio ID is required for refreshing prices.');
    }

    await this.requireAuth();

    const symbols = await this.loadSymbolsForPortfolio(normalized);
    const { summary, quotes } = await this.refreshQuotesForSymbols(symbols, { includeQuotes: true });

    return {
      ...summary,
      portfolioId: normalized,
      quotes
    };
  }

  static async getHistoricalPrices(ticker: string, range: HistoricalRange): Promise<HistoricalPricePoint[]> {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) {
      return [];
    }

    await this.requireAuth();

    return this.fetchYahooHistorical(normalized, range);
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

