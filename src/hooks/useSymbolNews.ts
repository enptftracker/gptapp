import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SymbolNewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface FetchCompanyNewsResponse {
  symbol?: string;
  provider?: string;
  news?: SymbolNewsItem[];
}

export const createFallbackNews = (ticker: string): SymbolNewsItem[] => [
  {
    title: `${ticker} latest market coverage`,
    url: `https://www.google.com/search?q=${ticker}+stock+news`,
    publisher: 'Google News',
    publishedAt: new Date().toISOString(),
    summary: `Explore the most recent headlines and analysis for ${ticker}.`,
    sentiment: 'neutral'
  },
  {
    title: `${ticker} analyst commentary roundup`,
    url: `https://www.google.com/search?q=${ticker}+analyst+commentary`,
    publisher: 'Market Commentary',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    summary: `Get a quick overview of how analysts are reacting to ${ticker}'s performance.`,
    sentiment: 'neutral'
  },
  {
    title: `${ticker} sector highlights`,
    url: `https://www.google.com/search?q=${ticker}+sector+news`,
    publisher: 'Sector Watch',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    summary: `Review the latest developments impacting ${ticker} and its peers.`,
    sentiment: 'neutral'
  }
];

async function fetchSymbolNews(ticker: string): Promise<SymbolNewsItem[]> {
  try {
    const { data, error } = await supabase.functions.invoke<FetchCompanyNewsResponse>(
      'fetch-company-news',
      {
        body: { ticker }
      }
    );

    if (error) {
      throw error;
    }

    const articles: SymbolNewsItem[] = Array.isArray(data?.news)
      ? data.news.map((item) => ({
          ...item,
          sentiment: item.sentiment ?? 'neutral'
        }))
      : [];

    return articles.length > 0 ? articles : createFallbackNews(ticker);
  } catch (err) {
    console.error('Error fetching symbol news:', err);
    throw err instanceof Error ? err : new Error('Failed to fetch news');
  }
}

export function useSymbolNews(ticker: string | undefined) {
  const normalizedTicker = (ticker || '').toUpperCase();
  const fallbackNews = useMemo(
    () => (normalizedTicker ? createFallbackNews(normalizedTicker) : []),
    [normalizedTicker]
  );

  const query = useQuery<SymbolNewsItem[]>({
    queryKey: ['symbol-news', normalizedTicker],
    queryFn: () => fetchSymbolNews(normalizedTicker),
    enabled: !!normalizedTicker,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30
  });

  const data = query.data && query.data.length > 0 ? query.data : fallbackNews;

  return {
    data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
