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
  provider: 'alphavantage';
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

class MarketDataAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataAuthorizationError';
  }
}

class MarketDataServiceImpl {
  static readonly PROVIDER_STORAGE_KEY = 'market-data-provider';
  private static readonly ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
  private static readonly ALPHA_INTRADAY_INTERVAL = '5min';

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

  private static getAlphaVantageApiKey(): string {
    const metaEnv = (import.meta as ImportMeta | undefined)?.env as
      | Record<string, string | undefined>
      | undefined;
    const candidate = metaEnv?.VITE_ALPHAVANTAGE_API_KEY ?? metaEnv?.ALPHAVANTAGE_API_KEY;
    const processEnv = typeof process !== 'undefined' ? process.env : undefined;
    const fallback = processEnv?.VITE_ALPHAVANTAGE_API_KEY ?? processEnv?.ALPHAVANTAGE_API_KEY;
    const key = candidate ?? fallback ?? '';
    return typeof key === 'string' ? key.trim() : '';
  }

  private static buildAlphaVantageUrl(params: Record<string, string>): string {
    const apiKey = this.getAlphaVantageApiKey();
    if (!apiKey) {
      throw new Error('Alpha Vantage API key is not configured.');
    }

    const url = new URL(this.ALPHA_VANTAGE_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    url.searchParams.set('apikey', apiKey);
    return url.toString();
  }

  private static parseAlphaDate(value: unknown): Date {
    if (typeof value === 'string') {
      const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private static async parseAlphaJson(response: Response, context: string): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      console.error(`Failed to parse ${context}:`, error);
      throw new Error('Alpha Vantage returned an invalid response.');
    }
  }

  private static extractAlphaError(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const container = payload as Record<string, unknown>;
    const messageCandidate =
      container['Error Message'] ?? container['Note'] ?? container['Information'];

    if (typeof messageCandidate === 'string' && messageCandidate.trim().length > 0) {
      return messageCandidate.trim();
    }

    return null;
  }

  private static async fetchAlphaQuote(symbol: string): Promise<LiveQuote> {
    const url = this.buildAlphaVantageUrl({
      function: 'GLOBAL_QUOTE',
      symbol
    });
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.error('Alpha Vantage quote request failed:', error);
      throw new Error('Unable to reach the market data provider.');
    }

    if (!response.ok) {
      throw new Error(`Alpha Vantage request failed (${response.status}).`);
    }

    const quotePayload = await this.parseAlphaJson(response, 'Alpha Vantage quote response');
    const providerError = this.extractAlphaError(quotePayload);

    if (providerError) {
      throw new Error(`Alpha Vantage error: ${providerError}`);
    }

    const result = (quotePayload as { 'Global Quote'?: Record<string, unknown> })?.['Global Quote'];

    if (!result || Object.keys(result).length === 0) {
      throw new Error('Alpha Vantage returned no data for the requested symbol.');
    }

    const record = result as Record<string, unknown>;

    const priceCandidate = this.toNumber(record['05. price']);

    if (typeof priceCandidate !== 'number') {
      throw new Error('Alpha Vantage returned an invalid price.');
    }

    const changeCandidate = this.toNumber(record['09. change']) ?? 0;
    const changePercentCandidate = this.toNumber(record['10. change percent']) ?? 0;
    const volumeCandidate = this.toNumber(record['06. volume']);
    const lastUpdated = this.parseAlphaDate(record['07. latest trading day']);

    return {
      symbol,
      price: this.round(priceCandidate),
      change: this.round(changeCandidate),
      changePercent: this.round(changePercentCandidate),
      volume: typeof volumeCandidate === 'number' ? volumeCandidate : undefined,
      lastUpdated,
      provider: 'alphavantage'
    };
  }

  private static async fetchAlphaHistorical(
    symbol: string,
    range: HistoricalRange
  ): Promise<HistoricalPricePoint[]> {
    if (range === '1D') {
      return this.fetchAlphaIntraday(symbol);
    }

    return this.fetchAlphaDaily(symbol, range);
  }

  private static async fetchAlphaIntraday(symbol: string): Promise<HistoricalPricePoint[]> {
    const url = this.buildAlphaVantageUrl({
      function: 'TIME_SERIES_INTRADAY',
      symbol,
      interval: this.ALPHA_INTRADAY_INTERVAL,
      outputsize: 'compact'
    });

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.error('Alpha Vantage intraday request failed:', error);
      throw new Error('Unable to reach the market data provider.');
    }

    if (!response.ok) {
      throw new Error(`Alpha Vantage intraday request failed (${response.status}).`);
    }

    const intradayPayload = await this.parseAlphaJson(
      response,
      'Alpha Vantage intraday response'
    );
    const providerError = this.extractAlphaError(intradayPayload);
    if (providerError) {
      throw new Error(`Alpha Vantage error: ${providerError}`);
    }

    const seriesKey = `Time Series (${this.ALPHA_INTRADAY_INTERVAL})`;
    const series = (intradayPayload as Record<string, unknown>)[seriesKey] as Record<string, Record<string, unknown>> | undefined;

    if (!series) {
      throw new Error('Alpha Vantage returned no intraday data.');
    }

    const points: HistoricalPricePoint[] = [];

    Object.entries(series).forEach(([time, value]) => {
      const price = this.toNumber(value?.['4. close']);
      if (typeof price !== 'number') {
        return;
      }

      const parsedTime = new Date(`${time.replace(' ', 'T')}Z`);
      if (Number.isNaN(parsedTime.getTime())) {
        return;
      }

      points.push({
        time: parsedTime.toISOString(),
        price: this.round(price)
      });
    });

    return points.sort((a, b) => a.time.localeCompare(b.time));
  }

  private static readonly dailyRangeLimits: Partial<Record<HistoricalRange, number>> = {
    '1W': 7,
    '1M': 31,
    '3M': 93,
    '6M': 186,
    '1Y': 372,
    '5Y': 1860
  };

  private static async fetchAlphaDaily(
    symbol: string,
    range: Exclude<HistoricalRange, '1D'>
  ): Promise<HistoricalPricePoint[]> {
    const url = this.buildAlphaVantageUrl({
      function: 'TIME_SERIES_DAILY_ADJUSTED',
      symbol,
      outputsize: range === 'MAX' || range === '5Y' ? 'full' : 'compact'
    });

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      console.error('Alpha Vantage daily request failed:', error);
      throw new Error('Unable to reach the market data provider.');
    }

    if (!response.ok) {
      throw new Error(`Alpha Vantage daily request failed (${response.status}).`);
    }

    const dailyPayload = await this.parseAlphaJson(response, 'Alpha Vantage daily response');
    const providerError = this.extractAlphaError(dailyPayload);
    if (providerError) {
      throw new Error(`Alpha Vantage error: ${providerError}`);
    }

    const series = (dailyPayload as { 'Time Series (Daily)'?: Record<string, Record<string, unknown>> })?.['Time Series (Daily)'];

    if (!series) {
      throw new Error('Alpha Vantage returned no daily historical data.');
    }

    const entries = Object.entries(series)
      .map(([time, value]) => {
        const price = this.toNumber(value?.['5. adjusted close'] ?? value?.['4. close']);
        const parsedTime = new Date(`${time}T00:00:00Z`);
        if (typeof price !== 'number' || Number.isNaN(parsedTime.getTime())) {
          return null;
        }

        return {
          time: parsedTime.toISOString(),
          price: this.round(price)
        };
      })
      .filter((entry): entry is HistoricalPricePoint => Boolean(entry));

    entries.sort((a, b) => a.time.localeCompare(b.time));

    const limit = this.dailyRangeLimits[range];
    if (typeof limit === 'number' && entries.length > limit) {
      return entries.slice(-limit);
    }

    return entries;
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
        const quote = await this.fetchAlphaQuote(symbol.ticker);
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
      provider: 'alphavantage',
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
      const quote = await this.fetchAlphaQuote(normalized);

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

    return this.fetchAlphaHistorical(normalized, range);
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

