import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTION_URL } from '@/integrations/supabase/env';
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError
} from '@supabase/supabase-js';

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

  private static getFunctionHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY
    };
  }

  private static getFunctionUrl(): string {
    const trimmed = SUPABASE_FUNCTION_URL?.trim();
    if (!trimmed) {
      throw new Error('Supabase function URL is not configured.');
    }

    const base = trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    return new URL('market-data', base).toString();
  }

  private static extractErrorMessage(payload: unknown): string | null {
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const errorMessage = record.error;
      const message = record.message;

      if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
        return errorMessage;
      }

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return null;
  }

  private static async extractHttpErrorMessage(error: FunctionsHttpError): Promise<string | null> {
    try {
      if (error.context && typeof error.context.json === 'function') {
        const details = await error.context.json();
        return this.extractErrorMessage(details);
      }
    } catch (parseError) {
      console.error('Failed to parse market data error response:', parseError);
    }

    return null;
  }

  private static tryParseJson(raw: string | null): unknown | null {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to parse market data response JSON:', error);
      return null;
    }
  }

  private static async directFunctionRequest<T>(
    body: Record<string, unknown>,
    token: string,
    fallbackMessage?: string
  ): Promise<T> {
    const requestUrl = this.getFunctionUrl();
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: this.getFunctionHeaders(token),
        body: JSON.stringify(body)
      });
    } catch (networkError) {
      console.error('Direct market data request failed:', networkError);
      throw new Error(
        fallbackMessage ?? 'Unable to reach the market data service. Please check your connection and try again.'
      );
    }

    if (response.status === 401) {
      throw new MarketDataAuthorizationError('Please sign in to update market data.');
    }

    const contentType = response.headers.get('content-type') ?? '';
    let payload: unknown | null = null;

    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (parseError) {
        console.error('Failed to parse market data JSON response:', parseError);
      }
    } else {
      try {
        const textBody = await response.text();
        payload = this.tryParseJson(textBody) ?? textBody;
      } catch (readError) {
        console.error('Failed to read market data response body:', readError);
      }
    }

    if (!response.ok) {
      const message = this.extractErrorMessage(payload) ??
        fallbackMessage ??
        `Market data request failed (${response.status}).`;
      throw new Error(message);
    }

    if (payload == null || typeof payload === 'string') {
      throw new Error('Market data response was empty.');
    }

    return payload as T;
  }

  private static async invokeFunction<T>(body: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    let response;
    try {
      response = await supabase.functions.invoke<T>('market-data', {
        body,
        headers: this.getFunctionHeaders(token)
      });
    } catch (invokeError) {
      if (invokeError instanceof MarketDataAuthorizationError) {
        throw invokeError;
      }

      console.error('Supabase function invocation failed, attempting direct fetch:', invokeError);
      return this.directFunctionRequest<T>(body, token);
    }

    const { data, error } = response;

    if (!error) {
      if (data == null) {
        throw new Error('Market data response was empty.');
      }

      return data;
    }

    if (error instanceof FunctionsHttpError) {
      if (error.status === 401) {
        throw new MarketDataAuthorizationError('Please sign in to update market data.');
      }

      const message = await this.extractHttpErrorMessage(error);
      console.warn('Supabase function responded with an error, attempting direct fetch:', {
        status: error.status,
        message
      });

      return this.directFunctionRequest<T>(
        body,
        token,
        message ?? `Market data request failed (${error.status}).`
      );
    }

    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      console.warn('Supabase function could not reach the market data service, attempting direct fetch:', error);
      return this.directFunctionRequest<T>(body, token);
    }

    const fallbackMessage = error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message
      : undefined;

    console.warn('Unexpected Supabase function error, attempting direct fetch:', error);
    return this.directFunctionRequest<T>(body, token, typeof fallbackMessage === 'string' ? fallbackMessage : undefined);
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
