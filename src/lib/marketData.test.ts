import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';

type MarketDataModule = typeof import('./marketData');

let MarketDataService: MarketDataModule['MarketDataService'];

type BatchInvoke = (...args: unknown[]) => Promise<unknown>;
type FetchDirect = (symbol: { id: string; ticker: string }) => Promise<{ success: boolean; message?: string }>;

describe('MarketDataService.batchUpdatePrices fallback handling', () => {
  const symbols = [
    { id: '1', ticker: 'AAPL' },
    { id: '2', ticker: 'MSFT' },
  ];

  let originalInvoke: BatchInvoke;
  let originalFetchDirect: FetchDirect;

  beforeAll(async () => {
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

    ({ MarketDataService } = await import('./marketData'));
  });

  beforeEach(() => {
    originalInvoke = (MarketDataService as unknown as { invokeMarketData: BatchInvoke }).invokeMarketData;
    originalFetchDirect = (MarketDataService as unknown as { fetchAndPersistDirectQuote: FetchDirect }).fetchAndPersistDirectQuote;
  });

  afterEach(() => {
    (MarketDataService as unknown as { invokeMarketData: BatchInvoke }).invokeMarketData = originalInvoke;
    (MarketDataService as unknown as { fetchAndPersistDirectQuote: FetchDirect }).fetchAndPersistDirectQuote = originalFetchDirect;
  });

  it('marks symbols as successful when fallback direct fetch succeeds', async () => {
    const invokeMock = mock<BatchInvoke>(async () => null);
    const fallbackMock = mock<FetchDirect>(async () => ({ success: true }));

    (MarketDataService as unknown as { invokeMarketData: BatchInvoke }).invokeMarketData = invokeMock;
    (MarketDataService as unknown as { fetchAndPersistDirectQuote: FetchDirect }).fetchAndPersistDirectQuote = fallbackMock;

    const summary = await MarketDataService.batchUpdatePrices(symbols);

    expect(summary.successCount).toBe(symbols.length);
    expect(summary.errorCount).toBe(0);
    expect(fallbackMock.mock.calls.length).toBe(symbols.length);
  });

  it('rejects the mutation when both edge and direct fetches fail', async () => {
    const invokeMock = mock<BatchInvoke>(async () => {
      throw new Error('edge failure');
    });
    const fallbackMock = mock<FetchDirect>(async () => ({ success: false, message: 'direct failure' }));

    (MarketDataService as unknown as { invokeMarketData: BatchInvoke }).invokeMarketData = invokeMock;
    (MarketDataService as unknown as { fetchAndPersistDirectQuote: FetchDirect }).fetchAndPersistDirectQuote = fallbackMock;

    await expect(MarketDataService.batchUpdatePrices(symbols)).rejects.toThrow('Failed to update prices for all tickers.');
    expect(fallbackMock.mock.calls.length).toBe(symbols.length);
  });
});
