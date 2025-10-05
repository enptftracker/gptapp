import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HistoricalRange, MarketDataService } from '@/lib/marketData';
import { symbolService } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export function useMarketData(ticker: string) {
  return useQuery({
    queryKey: ['market-data', ticker],
    queryFn: () => MarketDataService.getMarketData(ticker),
    enabled: !!ticker,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });
}

export const HISTORICAL_RANGES: HistoricalRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export function useHistoricalPrices(ticker: string, range: HistoricalRange) {
  return useQuery({
    queryKey: ['market-data', 'historical', ticker, range],
    queryFn: () => MarketDataService.getHistoricalPrices(ticker, range),
    enabled: !!ticker,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

export function useUpdatePrices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const symbols = await symbolService.getAll();
      await MarketDataService.batchUpdatePrices(symbols.map(s => ({ id: s.id, ticker: s.ticker })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] });
      toast({
        title: "Prices updated",
        description: "Market data has been refreshed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating prices",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: () => MarketDataService.searchSymbols(query),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}