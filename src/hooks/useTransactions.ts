import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionService, Transaction } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: transactionService.getAll,
  });
}

export function usePortfolioTransactions(portfolioId: string) {
  return useQuery({
    queryKey: ['transactions', 'portfolio', portfolioId],
    queryFn: () => transactionService.getByPortfolio(portfolioId),
    enabled: !!portfolioId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: transactionService.create,
    onSuccess: async () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      
      // Force refresh of price data for better accuracy
      queryClient.invalidateQueries({ queryKey: ['market-data'] });
      
      toast({
        title: "Transaction added",
        description: "Your transaction has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding transaction",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}