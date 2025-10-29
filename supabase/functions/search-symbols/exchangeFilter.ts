export interface FinnhubSearchEntry {
  description?: string;
  displaySymbol?: string;
  symbol?: string;
  type?: string;
  currency?: string;
}

/**
 * Allow-listed exchange identifiers derived from Finnhub search responses.
 *
 * Prefixes usually appear before a colon (e.g. `NASDAQ:AAPL`) while suffixes
 * are appended to the ticker (e.g. `VOD.L`, `AIR.PA`). Only prefixes/suffixes
 * included below are considered supported – update this list to expand venue
 * coverage.
 */
export const ALLOWED_EXCHANGE_PREFIXES = new Set<string>([
  // US venues
  "NASDAQ",
  "NAS",
  "NSDQ",
  "NYSE",
  "NYSEARCA",
  "NYSEMKT",
  "NYSEAMERICAN",
  "AMEX",
  "ARCA",
  "BATS",
  "IEX",
  // Major crypto venues
  "BINANCE",
  "COINBASE",
  "KRAKEN",
  "BITSTAMP",
  "BITFINEX",
  // Major FX providers
  "OANDA",
  "FXCM",
  "FOREX",
]);

export const ALLOWED_EXCHANGE_SUFFIXES = new Set<string>([
  // US shorthand suffixes occasionally returned by Finnhub
  "US",
  "N",
  "O",
  "A",
  // London Stock Exchange
  "L",
  "LN",
  "LON",
  // Euronext (Paris, Amsterdam, Brussels, Lisbon, Dublin)
  "PA",
  "AS",
  "BR",
  "LS",
  "IR",
  // Deutsche Börse / Xetra
  "DE",
  "F",
  // SIX Swiss Exchange
  "SW",
  "VX",
  // OMX Nordic exchanges
  "ST",
  "CO",
  "HE",
  "IC",
  "OL",
  // Borsa Italiana
  "MI",
  // Vienna Stock Exchange
  "VI",
]);

const deriveExchangeIdentifiers = (value?: string | null): string[] => {
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return [];
  }

  const identifiers = new Set<string>();

  if (trimmed.includes(":")) {
    const prefix = trimmed.split(":")[0];
    if (prefix) {
      identifiers.add(prefix);
    }
  }

  const suffixMatch = trimmed.match(/\.([A-Z]{1,4})$/);
  if (suffixMatch) {
    identifiers.add(suffixMatch[1]);
  }

  return Array.from(identifiers);
};

const isAllowedFinnhubEntry = (entry: FinnhubSearchEntry): boolean => {
  const sources = [entry.symbol, entry.displaySymbol];
  const identifiers = sources.flatMap((value) => deriveExchangeIdentifiers(value));

  if (identifiers.length === 0) {
    return true;
  }

  return identifiers.some((identifier) =>
    ALLOWED_EXCHANGE_PREFIXES.has(identifier) || ALLOWED_EXCHANGE_SUFFIXES.has(identifier)
  );
};

export const filterAllowedFinnhubResults = (
  entries: FinnhubSearchEntry[],
): FinnhubSearchEntry[] => entries.filter(isAllowedFinnhubEntry);
