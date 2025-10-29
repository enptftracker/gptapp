import { describe, expect, it } from "bun:test";

import { filterAllowedFinnhubResults } from "./exchangeFilter";

describe("filterAllowedFinnhubResults", () => {
  it("keeps US and major EU listings while dropping unsupported venues", () => {
    const entries = [
      { symbol: "AAPL", displaySymbol: "AAPL" },
      { symbol: "NASDAQ:MSFT", displaySymbol: "MSFT" },
      { symbol: "VOD.L", displaySymbol: "VOD.L" },
      { symbol: "SHOP.TO", displaySymbol: "SHOP.TO" },
      { symbol: "TSX:BN", displaySymbol: "BN.TO" },
    ];

    const filtered = filterAllowedFinnhubResults(entries);

    expect(filtered).toEqual([
      { symbol: "AAPL", displaySymbol: "AAPL" },
      { symbol: "NASDAQ:MSFT", displaySymbol: "MSFT" },
      { symbol: "VOD.L", displaySymbol: "VOD.L" },
    ]);
  });

  it("retains crypto and FX venues from major providers", () => {
    const entries = [
      { symbol: "BINANCE:BTCUSDT", displaySymbol: "BTCUSDT" },
      { symbol: "COINBASE:ETHUSD", displaySymbol: "ETH-USD" },
      { symbol: "KRAKEN:SOLUSD", displaySymbol: "SOL/USD" },
      { symbol: "OANDA:EURUSD", displaySymbol: "EUR/USD" },
      { symbol: "FXCM:GBPUSD", displaySymbol: "GBP/USD" },
      { symbol: "FOREX:USDJPY", displaySymbol: "USDJPY" },
    ];

    const filtered = filterAllowedFinnhubResults(entries);

    expect(filtered).toEqual(entries);
  });
});
