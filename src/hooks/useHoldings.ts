import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTransactions } from './useTransactions';
import { usePortfolios } from './usePortfolios';
import { symbolService, priceService, profileService, TransactionWithSymbol } from '@/lib/supabase';
import { PortfolioCalculations } from '@/lib/calculations';

function createTransactionsSignature(transactions: TransactionWithSymbol[], includePortfolioId: boolean = false) {
  if (transactions.length === 0) return '';

  return transactions
    .map(transaction => {
      const signatureParts = [
        transaction.id,
        transaction.updated_at,
        transaction.quantity,
        transaction.unit_price,
        transaction.type,
        transaction.trade_date,
        transaction.symbol_id ?? ''
      ];

      if (includePortfolioId) {
        signatureParts.push(transaction.portfolio_id);
      }

      return signatureParts.join('::');
    })
    .join('|');
}

function usePortfolioTransactionSnapshot(portfolioId: string) {
  const { data: allTransactions = [], isLoading: transactionsLoading } = useTransactions();

  const portfolioTransactions = useMemo(
    () => allTransactions.filter(transaction => transaction.portfolio_id === portfolioId),
    [allTransactions, portfolioId]
  );

  const transactionsSignature = useMemo(
    () => createTransactionsSignature(portfolioTransactions),
    [portfolioTransactions]
  );

  return { transactionsLoading, portfolioTransactions, transactionsSignature };
}

export function usePortfolioHoldings(portfolioId: string) {
  const { transactionsLoading, portfolioTransactions, transactionsSignature } = usePortfolioTransactionSnapshot(portfolioId);

  return useQuery({
    queryKey: ['holdings', portfolioId, transactionsSignature],
    queryFn: async () => {
      // Get all symbols referenced in transactions
      const symbolIds = [...new Set(portfolioTransactions
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
        portfolioTransactions,
        symbols,
        validPrices,
        lotMethod
      );
    },
    enabled: !!portfolioId && !transactionsLoading,
  });
}

export function usePortfolioMetrics(portfolioId: string) {
  const { transactionsLoading, portfolioTransactions, transactionsSignature } = usePortfolioTransactionSnapshot(portfolioId);

  return useQuery({
    queryKey: ['metrics', portfolioId, transactionsSignature],
    queryFn: async () => {
      const symbolIds = [...new Set(portfolioTransactions
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
        portfolioTransactions,
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
    () => createTransactionsSignature(transactions, true),
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