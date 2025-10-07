import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, UseMutateFunction } from '@tanstack/react-query';
import {
  HistoricalRange,
  MarketDataService,
  BatchUpdateProgressState,
  BatchUpdateSummary
} from '@/lib/marketData';
import { symbolService } from '@/lib/supabase';

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

export type UpdatePricesStatus = 'idle' | 'in-progress' | 'completed' | 'failed';

export interface UpdatePricesResult {
  status: UpdatePricesStatus;
  progress: BatchUpdateProgressState | null;
  summary: BatchUpdateSummary | null;
  errorMessage: string | null;
  reset: () => void;
  mutate: UseMutateFunction<BatchUpdateSummary, unknown, void, unknown>;
  mutateAsync: () => Promise<BatchUpdateSummary>;
  isPending: boolean;
}

export function useUpdatePrices(): UpdatePricesResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<UpdatePricesStatus>('idle');
  const [progress, setProgress] = useState<BatchUpdateProgressState | null>(null);
  const [summary, setSummary] = useState<BatchUpdateSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation<BatchUpdateSummary, unknown, void>({
    mutationFn: async () => {
      const symbols = await symbolService.getAll();
      const items = symbols.map(symbol => ({ id: symbol.id, ticker: symbol.ticker }));
      const totalBatches = items.length === 0
        ? 0
        : Math.ceil(items.length / MarketDataService.MAX_SYMBOLS_PER_BATCH);

      setStatus('in-progress');
      setSummary(null);
      setErrorMessage(null);
      setProgress({
        currentBatch: 0,
        totalBatches,
        successCount: 0,
        errorCount: 0,
        errors: []
      });

      const result = await MarketDataService.batchUpdatePrices(items, update => {
        setProgress(update);
      });

      return result;
    },
    onSuccess: async (result) => {
      setStatus('completed');
      setSummary(result);
      setProgress({
        currentBatch: result.totalBatches,
        totalBatches: result.totalBatches,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] }),
      ]);
    },
    onError: (error) => {
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update prices.');
    }
  });

  const reset = () => {
    setStatus('idle');
    setProgress(null);
    setSummary(null);
    setErrorMessage(null);
    mutation.reset();
  };

  return {
    status,
    progress,
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