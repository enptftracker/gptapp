import { describe, expect, it } from 'bun:test';
import {
  WATCHLIST_FRESHNESS_WINDOW_MS,
  WATCHLIST_FUTURE_TOLERANCE_MS,
  isCacheEntryStale,
} from './watchlistStaleness';

describe('isCacheEntryStale', () => {
  const now = 1_700_000_000_000;

  it('treats missing timestamps as stale', () => {
    expect(isCacheEntryStale(undefined, now)).toBe(true);
    expect(isCacheEntryStale({ asof: undefined }, now)).toBe(true);
  });

  it('flags cache entries older than the freshness window', () => {
    const staleTimestamp = now - WATCHLIST_FRESHNESS_WINDOW_MS - 1;
    expect(isCacheEntryStale({ asof: staleTimestamp }, now)).toBe(true);
  });

  it('keeps recent cache entries fresh', () => {
    const freshTimestamp = now - (WATCHLIST_FRESHNESS_WINDOW_MS - 1_000);
    expect(isCacheEntryStale({ asof: freshTimestamp }, now)).toBe(false);
  });

  it('accepts cache entries slightly ahead of the current time', () => {
    const slightlyFuture = now + WATCHLIST_FUTURE_TOLERANCE_MS - 1_000;
    expect(isCacheEntryStale({ asof: slightlyFuture }, now)).toBe(false);
  });

  it('invalidates cache entries too far in the future', () => {
    const farFuture = now + WATCHLIST_FUTURE_TOLERANCE_MS + 1_000;
    expect(isCacheEntryStale({ asof: farFuture }, now)).toBe(true);
  });
});
