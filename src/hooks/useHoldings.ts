import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioTransactions, useTransactions } from './useTransactions';
import { usePortfolios } from './usePortfolios';
import { symbolService, priceService, profileService } from '@/lib/supabase';
import { PortfolioCalculations } from '@/lib/calculations';

export function usePortfolioHoldings(portfolioId: string) {
  const { data: transactions = [], isLoading: transactionsLoading } = usePortfolioTransactions(portfolioId);

  const transactionsSignature = useMemo(
    () => transactions
      .filter(t => t.portfolio_id === portfolioId)
      .map(t => [
        t.id,
        t.updated_at,
        t.quantity,
        t.unit_price,
        t.type,
        t.trade_date,
        t.symbol_id
      ].join('::'))
      .join('|'),
    [portfolioId, transactions]
  );

  return useQuery({
    queryKey: ['holdings', portfolioId, transactionsSignature],
    queryFn: async () => {
      // Get all symbols referenced in transactions
      const symbolIds = [...new Set(transactions
        .filter(t => t.symbol_id)
        .map(t => t.symbol_id!))];
      
      if (symbolIds.length === 0) return [];

      // Fetch symbols, prices, and user profile
      const [symbols, prices, profile] = await Promise.all([
        symbolService.getAll(),
        Promise.all(symbolIds.map(id => priceService.getLatest(id))),
        profileService.get()
      ]);

      const validPrices = prices.filter(p => p !== null);
      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateHoldings(
        portfolioId,
        transactions,
        symbols,
        validPrices,
        lotMethod
      );
    },
    enabled: !!portfolioId && !transactionsLoading,
  });
}

export function usePortfolioMetrics(portfolioId: string) {
  const { data: transactions = [], isLoading: transactionsLoading } = usePortfolioTransactions(portfolioId);

  const transactionsSignature = useMemo(
    () => transactions
      .filter(t => t.portfolio_id === portfolioId)
      .map(t => [
        t.id,
        t.updated_at,
        t.quantity,
        t.unit_price,
        t.type,
        t.trade_date,
        t.symbol_id
      ].join('::'))
      .join('|'),
    [portfolioId, transactions]
  );

  return useQuery({
    queryKey: ['metrics', portfolioId, transactionsSignature],
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
        symbolService.getAll(),
        Promise.all(symbolIds.map(id => priceService.getLatest(id))),
        profileService.get()
      ]);

      const validPrices = prices.filter(p => p !== null);
      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculatePortfolioMetrics(
        portfolioId,
        transactions,
        symbols,
        validPrices,
        lotMethod
      );
    },
    enabled: !!portfolioId && !transactionsLoading,
  });
}

export function useConsolidatedHoldings() {
  const { data: portfolios = [] } = usePortfolios();
  const { data: transactions = [] } = useTransactions();

  const transactionsSignature = useMemo(
    () => transactions
      .map(t => [
        t.id,
        t.updated_at,
        t.quantity,
        t.unit_price,
        t.type,
        t.trade_date,
        t.symbol_id,
        t.portfolio_id
      ].join('::'))
      .join('|'),
    [transactions]
  );

  return useQuery({
    queryKey: ['consolidated-holdings', transactionsSignature],
    queryFn: async () => {
      if (portfolios.length === 0) return [];

      const symbolIds = [...new Set(transactions
        .filter(t => t.symbol_id)
        .map(t => t.symbol_id!))];
      
      if (symbolIds.length === 0) return [];

      const [symbols, prices, profile] = await Promise.all([
        symbolService.getAll(),
        Promise.all(symbolIds.map(id => priceService.getLatest(id))),
        profileService.get()
      ]);

      const validPrices = prices.filter(p => p !== null);
      const lotMethod = profile?.default_lot_method || 'FIFO';

      return PortfolioCalculations.calculateConsolidatedHoldings(
        portfolios,
        transactions,
        symbols,
        validPrices,
        lotMethod
      );
    },
  });
}