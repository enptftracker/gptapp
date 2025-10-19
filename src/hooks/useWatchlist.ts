import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WatchlistItem {
  id: string;
  symbol_id: string;
  symbol: {
    id: string;
    ticker: string;
    name: string;
    asset_type: string;
    quote_currency: string;
  };
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const { data: watchlistData, error } = await supabase
        .from('watchlist')
        .select(`
          id,
          symbol_id,
          symbol:symbols!inner(
            id,
            ticker,
            name,
            asset_type,
            quote_currency
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (watchlistData || []) as WatchlistItem[];
    }
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticker: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, find or create the symbol
      let symbolId;
      const { data: existingSymbol } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', ticker.toUpperCase())
        .single();

      if (existingSymbol) {
        symbolId = existingSymbol.id;
      } else {
        // Create new symbol
        const { data: newSymbol, error: symbolError } = await supabase
          .from('symbols')
          .insert({
            ticker: ticker.toUpperCase(),
            name: ticker.toUpperCase(),
            asset_type: 'EQUITY',
            quote_currency: 'USD',
            owner_id: user.id
          })
          .select('id')
          .single();

        if (symbolError) throw symbolError;
        symbolId = newSymbol.id;
      }

      // Check if already in watchlist
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('symbol_id', symbolId)
        .eq('owner_id', user.id)
        .single();

      if (existing) {
        throw new Error('Symbol already in watchlist');
      }

      // Add to watchlist
      const { data, error } = await supabase
        .from('watchlist')
        .insert({ symbol_id: symbolId, owner_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({
        title: "Added to watchlist",
        description: "Symbol has been added to your watchlist.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error adding to watchlist",
        description:
          error instanceof Error
            ? error.message
            : 'An unknown error occurred while adding the symbol.',
        variant: "destructive",
      });
    }
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (symbolId: string) => {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('symbol_id', symbolId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({
        title: "Removed from watchlist",
        description: "Symbol has been removed from your watchlist.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error removing from watchlist",
        description:
          error instanceof Error
            ? error.message
            : 'An unknown error occurred while removing the symbol.',
        variant: "destructive",
      });
    }
  });
}