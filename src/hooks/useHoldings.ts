import { useQuery } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { usePortfolios } from './usePortfolios';
import { symbolService, priceService, profileService } from '@/lib/supabase';
import { PortfolioCalculations } from '@/lib/calculations';

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
      const [symbols, prices, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        priceService.getManyLatest(symbolIds),
        profileService.get()
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateHoldings(
        portfolioId,
        transactions,
        symbols,
        prices,
        lotMethod
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

      const [symbols, prices, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        priceService.getManyLatest(symbolIds),
        profileService.get()
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculatePortfolioMetrics(
        portfolioId,
        transactions,
        symbols,
        prices,
        lotMethod
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

      const [symbols, prices, profile] = await Promise.all([
        symbolService.getMany(symbolIds),
        priceService.getManyLatest(symbolIds),
        profileService.get()
      ]);

      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateConsolidatedHoldings(
        portfolios,
        transactions,
        symbols,
        prices,
        lotMethod
      );
    },
    enabled: !portfoliosLoading && !transactionsLoading,
  });
}