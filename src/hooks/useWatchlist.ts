import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketDataService } from '@/lib/marketData';
import { useToast } from '@/hooks/use-toast';
import {
  WATCHLIST_FRESHNESS_WINDOW_MS,
  isCacheEntryStale,
} from './watchlistStaleness';

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
  price?: {
    price: number;
    change_24h: number;
    change_percent_24h: number;
    lastUpdated?: number;
    high_24h?: number;
    low_24h?: number;
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

      // Get price data for all symbols
      const symbolIds = watchlistData?.map(item => item.symbol_id) || [];

      if (symbolIds.length === 0) {
        return (watchlistData || []).map(item => ({ ...item, price: undefined })) as WatchlistItem[];
      }
      const { data: priceData } = await supabase
        .from('price_cache')
        .select('symbol_id, price, change_24h, change_percent_24h, high_24h, low_24h, asof')
        .in('symbol_id', symbolIds);

      const priceMap = new Map(
        (priceData || []).map(entry => [
          entry.symbol_id,
          {
            price: Number(entry.price),
            change_24h: Number(entry.change_24h ?? 0),
            change_percent_24h: Number(entry.change_percent_24h ?? 0),
            asof: entry.asof ? new Date(entry.asof).getTime() : undefined,
            high_24h: entry.high_24h != null ? Number(entry.high_24h) : undefined,
            low_24h: entry.low_24h != null ? Number(entry.low_24h) : undefined,
          }
        ])
      );

      const now = Date.now();
      const freshnessWindow = WATCHLIST_FRESHNESS_WINDOW_MS;

      const watchlistWithPrices = await Promise.all(
        (watchlistData || []).map(async (item) => {
          const cached = priceMap.get(item.symbol_id);
          let resolvedPrice = cached
            ? {
                price: cached.price,
                change_24h: cached.change_24h,
                change_percent_24h: cached.change_percent_24h,
                lastUpdated: cached.asof,
                high_24h: cached.high_24h,
                low_24h: cached.low_24h,
              }
            : undefined;

          const isStale = isCacheEntryStale(cached, now, freshnessWindow);

          if (isStale) {
            const fresh = await MarketDataService.getMarketData(item.symbol.ticker);
            if (fresh) {
              resolvedPrice = {
                price: fresh.price,
                change_24h: fresh.change,
                change_percent_24h: fresh.changePercent,
                lastUpdated: fresh.lastUpdated?.getTime() ?? Date.now(),
                high_24h: fresh.high,
                low_24h: fresh.low,
              };
            }
          }

          return {
            ...item,
            price: resolvedPrice,
          };
        })
      );

      return watchlistWithPrices as WatchlistItem[];
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
    onError: (error: any) => {
      toast({
        title: "Error adding to watchlist",
        description: error.message,
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
    onError: (error: any) => {
      toast({
        title: "Error removing from watchlist",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}