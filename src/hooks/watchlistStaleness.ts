export const WATCHLIST_FRESHNESS_WINDOW_MS = 1000 * 60 * 5; // 5 minutes
export const WATCHLIST_FUTURE_TOLERANCE_MS = 1000 * 5; // 5 seconds

export interface PriceCacheEntry {
  asof?: number;
}

export function isCacheEntryStale(
  cached: PriceCacheEntry | undefined,
  now: number,
  freshnessWindow: number = WATCHLIST_FRESHNESS_WINDOW_MS,
  futureTolerance: number = WATCHLIST_FUTURE_TOLERANCE_MS,
): boolean {
  if (!cached?.asof) {
    return true;
  }

  if (now - cached.asof > freshnessWindow) {
    return true;
  }

  if (cached.asof - now > futureTolerance) {
    return true;
  }

  return false;
}
