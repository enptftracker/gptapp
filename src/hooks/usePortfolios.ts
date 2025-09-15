import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioService, Portfolio } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function usePortfolios() {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: portfolioService.getAll,
  });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: portfolioService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast({
        title: "Portfolio created",
        description: "Your new portfolio has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating portfolio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Portfolio> }) =>
      portfolioService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      toast({
        title: "Portfolio updated",
        description: "Your portfolio has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating portfolio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => portfolioService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'portfolio', id] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics', id] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      toast({
        title: "Portfolio deleted",
        description: "Your portfolio has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting portfolio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}