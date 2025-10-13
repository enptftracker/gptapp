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

type InvokeFn = (body: Record<string, unknown>) => Promise<unknown>;
type AccessTokenFn = () => Promise<string>;

describe('MarketDataService.refreshPrices', () => {
  let MarketDataService: MarketDataModule['MarketDataService'];
  let originalInvoke: InvokeFn;
  let originalGetAccessToken: AccessTokenFn;

  const buildSummary = () => ({
    provider: 'yahoo' as const,
    totalSymbols: 2,
    updated: 2,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  });

  beforeAll(async () => {
    ({ MarketDataService } = await import('./marketData'));
  });

  beforeEach(() => {
    originalInvoke = (MarketDataService as unknown as { invokeFunction: InvokeFn }).invokeFunction;
    originalGetAccessToken = (MarketDataService as unknown as { getAccessToken: AccessTokenFn }).getAccessToken;
    (MarketDataService as unknown as { getAccessToken: AccessTokenFn }).getAccessToken = async () => 'token';
  });

  afterEach(() => {
    (MarketDataService as unknown as { invokeFunction: InvokeFn }).invokeFunction = originalInvoke;
    (MarketDataService as unknown as { getAccessToken: AccessTokenFn }).getAccessToken = originalGetAccessToken;
  });

  it('normalizes requested tickers before calling the edge function', async () => {
    const invokeMock = mock<InvokeFn>(async (body) => {
      expect(body).toEqual({ action: 'refresh_prices', symbols: ['AAPL', 'MSFT'] });
      return buildSummary();
    });

    (MarketDataService as unknown as { invokeFunction: InvokeFn }).invokeFunction = invokeMock;

    const summary = await MarketDataService.refreshPrices([' aapl ', 'AAPL', 'msft']);

    expect(invokeMock.mock.calls.length).toBe(1);
    expect(summary.provider).toBe('yahoo');
    expect(summary.startedAt).toBeInstanceOf(Date);
    expect(summary.completedAt).toBeInstanceOf(Date);
  });

  it('omits the symbols payload when no tickers are provided', async () => {
    const invokeMock = mock<InvokeFn>(async (body) => {
      expect(body).toEqual({ action: 'refresh_prices' });
      return buildSummary();
    });

    (MarketDataService as unknown as { invokeFunction: InvokeFn }).invokeFunction = invokeMock;

    await MarketDataService.refreshPrices();

    expect(invokeMock.mock.calls.length).toBe(1);
  });
});
