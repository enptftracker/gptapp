import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutateFunction } from '@tanstack/react-query';
import {
  HistoricalRange,
  HistoricalPricePoint,
  MarketDataService,
  PriceUpdateSummary
} from '@/lib/marketData';

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
  return useQuery<HistoricalPricePoint[], Error>({
    queryKey: ['market-data', 'historical', ticker, range],
    queryFn: () => MarketDataService.getHistoricalPrices(ticker, range),
    enabled: !!ticker,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

export type UpdatePricesStatus = 'idle' | 'running' | 'success' | 'error';

export interface UpdatePricesResult {
  status: UpdatePricesStatus;
  summary: PriceUpdateSummary | null;
  errorMessage: string | null;
  reset: () => void;
  mutate: UseMutateFunction<PriceUpdateSummary, unknown, void, unknown>;
  mutateAsync: () => Promise<PriceUpdateSummary>;
  isPending: boolean;
}

export function useUpdatePrices(): UpdatePricesResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<UpdatePricesStatus>('idle');
  const [summary, setSummary] = useState<PriceUpdateSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation<PriceUpdateSummary, unknown, void>({
    mutationFn: async () => {
      setStatus('running');
      setSummary(null);
      setErrorMessage(null);
      return MarketDataService.refreshAllPrices();
    },
    onSuccess: async (result) => {
      setStatus('success');
      setSummary(result);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] }),
      ]);
    },
    onError: (error) => {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update prices.');
    }
  });

  const reset = () => {
    setStatus('idle');
    setSummary(null);
    setErrorMessage(null);
    mutation.reset();
  };

  return {
    status,
    summary,
    errorMessage,
    reset,
    mutate: mutation.mutate,
    mutateAsync: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
  };
}

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: () => MarketDataService.searchSymbols(query),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}