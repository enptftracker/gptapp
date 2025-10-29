import { describe, expect, it } from 'bun:test';

const localStorageMock: Storage = {
  get length() {
    return 0;
  },
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

(globalThis as unknown as { localStorage: Storage }).localStorage = localStorageMock;

const { MarketDataService } = await import('./marketData');

describe('MarketDataService.searchSymbols', () => {
  it('normalizes crypto metadata from provider results', () => {
    const rawEntry = {
      ticker: 'binance:btcusdt',
      name: 'Bitcoin',
      assetType: 'cryptocurrency',
      quoteCurrency: 'USDT',
    };

    const result = (MarketDataService as unknown as {
      mapSearchResult(entry: typeof rawEntry): unknown;
    }).mapSearchResult(rawEntry) as {
      ticker: string;
      name: string;
      assetType: string;
      quoteCurrency: string;
    } | null;

    expect(result).toEqual({
      ticker: 'BINANCE:BTCUSDT',
      name: 'Bitcoin',
      assetType: 'CRYPTO',
      quoteCurrency: 'USD',
    });
  });
});
