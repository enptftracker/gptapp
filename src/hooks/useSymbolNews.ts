import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface SymbolNewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface YahooNewsItem {
  title?: string;
  link?: string;
  url?: string;
  publisher?: string;
  provider?: { name?: string };
  pubDate?: string;
  published_at?: string;
  summary?: string;
  excerpt?: string;
}

interface YahooNewsResponse {
  news?: YahooNewsItem[];
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
  const response = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=6`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch news');
  }

  const payload: YahooNewsResponse = await response.json();
  const articles = Array.isArray(payload.news)
    ? payload.news.slice(0, 6).map((item): SymbolNewsItem => ({
        title: item.title || `${ticker} update`,
        url: item.link || item.url || `https://www.google.com/search?q=${ticker}+stock`,
        publisher: item.publisher || item.provider?.name || 'Market News',
        publishedAt: item.pubDate || item.published_at || new Date().toISOString(),
        summary: item.summary || item.excerpt || `Latest update related to ${ticker}.`,
        sentiment: 'neutral'
      }))
    : [];

  return articles.length > 0 ? articles : createFallbackNews(ticker);
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
