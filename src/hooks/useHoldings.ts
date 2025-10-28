import { useQuery } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { usePortfolios } from './usePortfolios';
import { symbolService, profileService, fxRateService } from '@/lib/supabase';
import { PortfolioCalculations, QuoteSnapshot } from '@/lib/calculations';
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

export function usePortfolioHoldings(portfolioId: string) {
  const { data: transactions = [] } = useTransactions();
  const { data: portfolios = [] } = usePortfolios();

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
        fxRateService.getRelevantRates(baseCurrency, tradeCurrencies)
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
        fxRateService.getRelevantRates(baseCurrency, tradeCurrencies)
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
        fxRateService.getRelevantRates(baseCurrency, tradeCurrencies)
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