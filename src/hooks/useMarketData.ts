import { useQuery } from '@tanstack/react-query';
import {
  HistoricalRange,
  HistoricalPricePoint,
  MarketDataService
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

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: () => MarketDataService.searchSymbols(query),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}