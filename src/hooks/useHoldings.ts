import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { usePortfolios } from './usePortfolios';
import { symbolService, profileService, fxRateService, type FxRate } from '@/lib/supabase';
import { PortfolioCalculations, QuoteSnapshot, type FxRateSnapshot } from '@/lib/calculations';
import { MarketDataService } from '@/lib/marketData';

async function fetchLiveQuotes(symbols: { id: string; ticker: string }[]): Promise<QuoteSnapshot[]> {
  if (symbols.length === 0) {
    return [];
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      if (!symbol.ticker) {
        return null;
      }

      try {
        const quote = await MarketDataService.getMarketData(symbol.ticker);
        if (quote && typeof quote.price === 'number') {
          return {
            symbol_id: symbol.id,
            price: quote.price,
            asof: quote.lastUpdated ?? null,
          } satisfies QuoteSnapshot;
        }
      } catch (error) {
        console.error('Failed to fetch live quote for', symbol.ticker, error);
      }

      return null;
    })
  );

  return results.filter((entry): entry is QuoteSnapshot => entry !== null);
}

const normalizeCurrency = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const buildFxQueryKey = (baseCurrency: string, quoteCurrencies: string[]) => [
  'fx-rates',
  baseCurrency,
  quoteCurrencies.slice().sort().join('-')
];

const toFxSnapshot = (rate: FxRate | FxRateSnapshot): FxRateSnapshot => ({
  base_currency: rate.base_currency,
  quote_currency: rate.quote_currency,
  rate: rate.rate,
  asof: rate.asof,
});

const mergeFxRates = (stored: FxRateSnapshot[], live: FxRateSnapshot[]): FxRateSnapshot[] => {
  const merged = new Map<string, FxRateSnapshot>();

  const insert = (rate: FxRateSnapshot, overwrite = false) => {
    const base = normalizeCurrency(rate.base_currency);
    const quote = normalizeCurrency(rate.quote_currency);
    const numericRate = typeof rate.rate === 'number' ? rate.rate : Number.NaN;

    if (!base || !quote || !Number.isFinite(numericRate) || numericRate <= 0) {
      return;
    }

    const key = `${base}-${quote}`;
    const normalized: FxRateSnapshot = {
      base_currency: base,
      quote_currency: quote,
      rate: Number.parseFloat(numericRate.toFixed(6)),
      asof: typeof rate.asof === 'string'
        ? rate.asof
        : rate.asof instanceof Date
          ? rate.asof.toISOString()
          : undefined,
    };

    if (!merged.has(key) || overwrite) {
      merged.set(key, normalized);
    }
  };

  stored.forEach(rate => insert(rate, false));
  live.forEach(rate => insert(rate, true));

  return Array.from(merged.values());
};

const fetchAndPersistFxRates = async (
  baseCurrency: string,
  quoteCurrencies: string[],
): Promise<FxRateSnapshot[]> => {
  if (quoteCurrencies.length === 0) {
    return [];
  }

  try {
    const liveRates = await MarketDataService.getFxRates(baseCurrency, quoteCurrencies);

    if (liveRates.length > 0) {
      try {
        await fxRateService.saveRates(liveRates);
      } catch (error) {
        console.error('Failed to persist live FX rates', error);
      }
    }

    return liveRates;
  } catch (error) {
    console.error('Failed to fetch live FX rates', error);
    return [];
  }
};

const loadFxRates = async (
  baseCurrency: string,
  tradeCurrencies: string[],
  queryClient: QueryClient,
): Promise<FxRateSnapshot[]> => {
  const normalizedBase = normalizeCurrency(baseCurrency) ?? 'USD';
  const normalizedQuotes = Array.from(new Set(
    tradeCurrencies
      .map(currency => normalizeCurrency(currency))
      .filter((currency): currency is string => Boolean(currency) && currency !== normalizedBase)
  ));

  if (normalizedQuotes.length === 0) {
    return [];
  }

  const [storedRates, liveRates] = await Promise.all([
    fxRateService.getRelevantRates(normalizedBase, normalizedQuotes),
    queryClient.ensureQueryData({
      queryKey: buildFxQueryKey(normalizedBase, normalizedQuotes),
      queryFn: () => fetchAndPersistFxRates(normalizedBase, normalizedQuotes),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }).catch((error) => {
      console.error('Failed to cache live FX rates', error);
      return [] as FxRateSnapshot[];
    })
  ]);

  const storedSnapshots = storedRates.map(toFxSnapshot);
  return mergeFxRates(storedSnapshots, liveRates);
};

export function usePortfolioHoldings(portfolioId: string) {
  const { data: transactions = [] } = useTransactions();
  const { data: portfolios = [] } = usePortfolios();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['holdings', portfolioId],
    queryFn: async () => {
      // Get all symbols referenced in transactions
      const symbolIds = [...new Set(transactions
        .filter(t => t.symbol_id)
        .map(t => t.symbol_id!))];

      if (symbolIds.length === 0) return [];

      // Fetch symbols, prices, and user profile
      const [symbols, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        profileService.get()
      ]);

      const baseCurrency = profile?.base_currency ?? 'USD';
      const portfolioTransactions = transactions.filter(t => t.portfolio_id === portfolioId && t.symbol_id);
      const tradeCurrencies = Array.from(new Set(
        portfolioTransactions
          .map(t => t.trade_currency)
          .filter((currency): currency is string => Boolean(currency) && currency.toUpperCase() !== baseCurrency.toUpperCase())
      ));

      const [prices, fxRates] = await Promise.all([
        fetchLiveQuotes(
          symbols.map(symbol => ({ id: symbol.id, ticker: symbol.ticker }))
        ),
        loadFxRates(baseCurrency, tradeCurrencies, queryClient)
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateHoldings(
        portfolioId,
        transactions,
        symbols,
        prices,
        lotMethod,
        baseCurrency,
        fxRates
      );
    },
    enabled: !!portfolioId,
  });
}

export function usePortfolioMetrics(portfolioId: string) {
  const { data: transactions = [] } = useTransactions();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['metrics', portfolioId],
    queryFn: async () => {
      const symbolIds = [...new Set(transactions
        .filter(t => t.symbol_id)
        .map(t => t.symbol_id!))];
      
      if (symbolIds.length === 0) {
        return {
          portfolioId,
          totalEquity: 0,
          totalCost: 0,
          dailyPL: 0,
          dailyPLPercent: 0,
          totalPL: 0,
          totalPLPercent: 0,
          holdings: []
        };
      }

      const [symbols, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        profileService.get()
      ]);

      const baseCurrency = profile?.base_currency ?? 'USD';
      const portfolioTransactions = transactions.filter(t => t.portfolio_id === portfolioId && t.symbol_id);
      const tradeCurrencies = Array.from(new Set(
        portfolioTransactions
          .map(t => t.trade_currency)
          .filter((currency): currency is string => Boolean(currency) && currency.toUpperCase() !== baseCurrency.toUpperCase())
      ));

      const [prices, fxRates] = await Promise.all([
        fetchLiveQuotes(
          symbols.map(symbol => ({ id: symbol.id, ticker: symbol.ticker }))
        ),
        loadFxRates(baseCurrency, tradeCurrencies, queryClient)
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculatePortfolioMetrics(
        portfolioId,
        transactions,
        symbols,
        prices,
        lotMethod,
        baseCurrency,
        fxRates
      );
    },
    enabled: !!portfolioId,
  });
}

export function useConsolidatedHoldings() {
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['consolidated-holdings', portfolios.length, transactions.length],
    queryFn: async () => {
      if (portfolios.length === 0) return [];

      const symbolIds = [...new Set(transactions
        .filter(t => t.symbol_id)
        .map(t => t.symbol_id!))];
      
      if (symbolIds.length === 0) return [];

      const [symbols, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        profileService.get()
      ]);

      const baseCurrency = profile?.base_currency ?? 'USD';
      const tradeCurrencies = Array.from(new Set(
        transactions
          .filter(t => t.symbol_id)
          .map(t => t.trade_currency)
          .filter((currency): currency is string => Boolean(currency) && currency.toUpperCase() !== baseCurrency.toUpperCase())
      ));

      const [prices, fxRates] = await Promise.all([
        fetchLiveQuotes(
          symbols.map(symbol => ({ id: symbol.id, ticker: symbol.ticker }))
        ),
        loadFxRates(baseCurrency, tradeCurrencies, queryClient)
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateConsolidatedHoldings(
        portfolios,
        transactions,
        symbols,
        prices,
        lotMethod,
        baseCurrency,
        fxRates
      );
    },
    enabled: !portfoliosLoading && !transactionsLoading,
  });
}