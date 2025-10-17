import { useQuery } from '@tanstack/react-query';
import { priceService, transactionService, Transaction as DbTransaction } from '@/lib/supabase';
import { PortfolioCalculations, PortfolioHistoryPoint } from '@/lib/calculations';

async function buildHistoryForTransactions(transactions: DbTransaction[]) {
  if (!transactions || transactions.length === 0) {
    return [] as PortfolioHistoryPoint[];
  }

  const symbolIds = [...new Set(
    transactions
      .filter(transaction => transaction.symbol_id)
      .map(transaction => transaction.symbol_id!)
  )];

  const prices = symbolIds.length > 0
    ? await priceService.getManyLatest(symbolIds)
    : [];

  return PortfolioCalculations.calculatePortfolioHistory(transactions, prices);
}

export function useAllPortfoliosHistory() {
  return useQuery({
    queryKey: ['portfolio-history', 'all'],
    queryFn: async () => {
      const transactions = await transactionService.getAll();
      return buildHistoryForTransactions(transactions);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

export function usePortfolioHistory(portfolioId: string) {
  return useQuery({
    queryKey: ['portfolio-history', portfolioId],
    queryFn: async () => {
      const transactions = await transactionService.getByPortfolio(portfolioId);
      return buildHistoryForTransactions(transactions);
    },
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

