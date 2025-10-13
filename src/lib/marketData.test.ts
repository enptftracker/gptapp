import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';

if (typeof (globalThis as { localStorage?: Storage }).localStorage === 'undefined') {
  const storage = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    }
  } as Storage;
}

type MarketDataModule = typeof import('./marketData');

describe('MarketDataService.refreshPrices', () => {
  let MarketDataService: MarketDataModule['MarketDataService'];
  let originalRequireAuth: () => Promise<void>;
  let originalLoadSymbolsForTickers: (tickers: string[]) => Promise<{ symbols: Array<{ id: string; ticker: string }>; missing: string[] }>;
  let originalLoadSymbolsFromPositions: () => Promise<Array<{ id: string; ticker: string }>>;
  let originalRefreshQuotesForSymbols: (
    symbols: Array<{ id: string; ticker: string }>,
    options?: { includeQuotes?: boolean; missingTickers?: string[] }
  ) => Promise<{ summary: MarketDataModule['PriceUpdateSummary']; quotes: MarketDataModule['LiveQuote'][] }>;

  const buildSummary = (totalSymbols: number): MarketDataModule['PriceUpdateSummary'] => ({
    provider: 'alphavantage',
    totalSymbols,
    updated: totalSymbols,
    failed: 0,
    errors: [],
    startedAt: new Date(),
    completedAt: new Date()
  });

  beforeAll(async () => {
    ({ MarketDataService } = await import('./marketData'));
  });

  beforeEach(() => {
    originalRequireAuth = (MarketDataService as unknown as { requireAuth: () => Promise<void> }).requireAuth;
    originalLoadSymbolsForTickers = (MarketDataService as unknown as {
      loadSymbolsForTickers: typeof originalLoadSymbolsForTickers;
    }).loadSymbolsForTickers;
    originalLoadSymbolsFromPositions = (MarketDataService as unknown as {
      loadSymbolsFromPositions: typeof originalLoadSymbolsFromPositions;
    }).loadSymbolsFromPositions;
    originalRefreshQuotesForSymbols = (MarketDataService as unknown as {
      refreshQuotesForSymbols: typeof originalRefreshQuotesForSymbols;
    }).refreshQuotesForSymbols;

    (MarketDataService as unknown as { requireAuth: () => Promise<void> }).requireAuth = async () => {};
  });

  afterEach(() => {
    (MarketDataService as unknown as { requireAuth: () => Promise<void> }).requireAuth = originalRequireAuth;
    (MarketDataService as unknown as {
      loadSymbolsForTickers: typeof originalLoadSymbolsForTickers;
    }).loadSymbolsForTickers = originalLoadSymbolsForTickers;
    (MarketDataService as unknown as {
      loadSymbolsFromPositions: typeof originalLoadSymbolsFromPositions;
    }).loadSymbolsFromPositions = originalLoadSymbolsFromPositions;
    (MarketDataService as unknown as {
      refreshQuotesForSymbols: typeof originalRefreshQuotesForSymbols;
    }).refreshQuotesForSymbols = originalRefreshQuotesForSymbols;
  });

  it('normalizes requested tickers before refreshing quotes', async () => {
    const loadMock = mock(async (tickers: string[]) => {
      expect(tickers).toEqual(['AAPL', 'MSFT']);
      return {
        symbols: [
          { id: '1', ticker: 'AAPL' },
          { id: '2', ticker: 'MSFT' }
        ],
        missing: []
      };
    });

    const refreshMock = mock(async () => ({
      summary: buildSummary(2),
      quotes: []
    }));

    (MarketDataService as unknown as {
      loadSymbolsForTickers: typeof originalLoadSymbolsForTickers;
    }).loadSymbolsForTickers = loadMock;
    (MarketDataService as unknown as {
      refreshQuotesForSymbols: typeof originalRefreshQuotesForSymbols;
    }).refreshQuotesForSymbols = refreshMock;

    const summary = await MarketDataService.refreshPrices([' aapl ', 'AAPL', 'msft']);

    expect(loadMock.mock.calls.length).toBe(1);
    expect(refreshMock.mock.calls.length).toBe(1);
    expect(summary.provider).toBe('alphavantage');
    expect(summary.totalSymbols).toBe(2);
    expect(summary.startedAt).toBeInstanceOf(Date);
    expect(summary.completedAt).toBeInstanceOf(Date);
  });

  it('returns an empty summary when there are no holdings to refresh', async () => {
    const loadMock = mock(async () => [] as Array<{ id: string; ticker: string }>);
    const refreshMock = mock(async (symbols: Array<{ id: string; ticker: string }>) => {
      expect(symbols).toEqual([]);
      return {
        summary: buildSummary(0),
        quotes: []
      };
    });

    (MarketDataService as unknown as {
      loadSymbolsFromPositions: typeof originalLoadSymbolsFromPositions;
    }).loadSymbolsFromPositions = loadMock;
    (MarketDataService as unknown as {
      refreshQuotesForSymbols: typeof originalRefreshQuotesForSymbols;
    }).refreshQuotesForSymbols = refreshMock;

    const summary = await MarketDataService.refreshPrices();

    expect(loadMock.mock.calls.length).toBe(1);
    expect(refreshMock.mock.calls.length).toBe(1);
    expect(summary.totalSymbols).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.startedAt).toBeInstanceOf(Date);
    expect(summary.completedAt).toBeInstanceOf(Date);
  });
});
