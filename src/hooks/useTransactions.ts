import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionService, Transaction, TransactionWithSymbol } from '@/lib/supabase';
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
    onSuccess: async (createdTransaction) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (createdTransaction?.portfolio_id) {
        queryClient.invalidateQueries({ queryKey: ['transactions', 'portfolio', createdTransaction.portfolio_id] });
        queryClient.invalidateQueries({ queryKey: ['holdings', createdTransaction.portfolio_id] });
        queryClient.invalidateQueries({ queryKey: ['metrics', createdTransaction.portfolio_id] });
      }
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
      onError: (error: unknown) => {
        const description = error instanceof Error ? error.message : 'An unexpected error occurred.';
        toast({
          title: "Error adding transaction",
          description,
          variant: "destructive",
        });
      },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Transaction, 'id' | 'owner_id' | 'created_at' | 'updated_at'>> }) =>
      transactionService.update(id, updates),
    onSuccess: async (updatedTransaction) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (updatedTransaction?.portfolio_id) {
        queryClient.invalidateQueries({ queryKey: ['transactions', 'portfolio', updatedTransaction.portfolio_id] });
        queryClient.invalidateQueries({ queryKey: ['holdings', updatedTransaction.portfolio_id] });
        queryClient.invalidateQueries({ queryKey: ['metrics', updatedTransaction.portfolio_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      queryClient.invalidateQueries({ queryKey: ['market-data'] });

      toast({
        title: 'Transaction updated',
        description: 'Your transaction has been updated successfully.',
      });
    },
      onError: (error: unknown) => {
        const description = error instanceof Error ? error.message : 'An unexpected error occurred.';
        toast({
          title: 'Error updating transaction',
          description,
          variant: 'destructive',
        });
      }
  });
}


export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Transaction, 'id' | 'owner_id' | 'created_at' | 'updated_at'>> }) =>
      transactionService.update(id, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      queryClient.invalidateQueries({ queryKey: ['market-data'] });

      toast({
        title: 'Transaction updated',
        description: 'Your transaction has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating transaction',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}


export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({

    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });

      toast({
        title: 'Transaction deleted',
        description: 'The transaction has been removed.',
      });
    },

    onError: (error: any) => {
      toast({
        title: 'Error deleting transaction',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}

