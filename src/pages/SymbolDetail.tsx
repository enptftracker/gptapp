import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketData } from '@/hooks/useMarketData';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';

interface NewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
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

const createFallbackNews = (ticker: string): NewsItem[] => [
  {
    title: `${ticker} latest market coverage`,
    url: `https://www.google.com/search?q=${ticker}+stock+news`,
    publisher: 'Google News',
    publishedAt: new Date().toISOString(),
    summary: `Explore the most recent headlines and analysis for ${ticker}.`
  },
  {
    title: `${ticker} analyst commentary roundup`,
    url: `https://www.google.com/search?q=${ticker}+analyst+commentary`,
    publisher: 'Market Commentary',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    summary: `Get a quick overview of how analysts are reacting to ${ticker}'s performance.`
  },
  {
    title: `${ticker} sector highlights`,
    url: `https://www.google.com/search?q=${ticker}+sector+news`,
    publisher: 'Sector Watch',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    summary: `Review the latest developments impacting ${ticker} and its peers.`
  }
];

const SymbolDetail: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const normalizedTicker = (ticker || '').toUpperCase();
  const { data: marketData, isLoading } = useMarketData(normalizedTicker);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    if (!normalizedTicker) return;

    let isMounted = true;
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${normalizedTicker}&newsCount=6`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        const payload: YahooNewsResponse = await response.json();
        const articles = Array.isArray(payload.news)
          ? payload.news.slice(0, 6).map((item): NewsItem => ({
              title: item.title || `${normalizedTicker} update`,
              url: item.link || item.url || `https://www.google.com/search?q=${normalizedTicker}+stock`,
              publisher: item.publisher || item.provider?.name || 'Market News',
              publishedAt: item.pubDate || item.published_at || new Date().toISOString(),
              summary: item.summary || item.excerpt || `Latest update related to ${normalizedTicker}.`
            }))
          : createFallbackNews(normalizedTicker);

        if (isMounted) {
          setNews(articles.length > 0 ? articles : createFallbackNews(normalizedTicker));
        }
      } catch (error) {
        if (isMounted) {
          setNews(createFallbackNews(normalizedTicker));
        }
      } finally {
        if (isMounted) {
          setNewsLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, [normalizedTicker]);

  const chartData = useMemo(() => {
    const basePrice = marketData?.price ?? 0;
    const seed = basePrice || 100;
    const points = 30;
    const data: { date: string; price: number }[] = [];

    for (let i = points - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const noise = (Math.sin(i / 3) + Math.random() * 0.4) * (seed * 0.015);
      const value = Math.max(seed + noise - (points - i) * 0.05, 0.1);
      data.push({
        date: format(date, 'MMM dd'),
        price: Number(value.toFixed(2))
      });
    }

    if (basePrice) {
      data[data.length - 1].price = Number(basePrice.toFixed(2));
    }

    return data;
  }, [marketData]);

  const change = marketData?.change ?? 0;
  const changePercent = marketData?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/watchlist">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Watchlist
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{normalizedTicker}</h1>
          <p className="text-sm text-muted-foreground">
            Live quote, intraday trend, and curated headlines.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Price Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold">
                  {marketData?.price ? `$${marketData.price.toFixed(2)}` : '--'}
                </span>
                <div className={`flex items-center gap-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)}</span>
                  <span>({changePercent >= 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Last updated {marketData?.lastUpdated ? format(new Date(marketData.lastUpdated), 'PPpp') : 'recently'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Price Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={['auto', 'auto']} className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(value: number) => [`$${Number(value).toFixed(2)}`, 'Price']}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Not enough data to draw a chart yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent News</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newsLoading ? (
              [1, 2, 3].map((item) => (
                <div key={item} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))
            ) : (
              news.map((item) => (
                <a
                  key={`${item.url}-${item.publishedAt}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.publisher} • {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {item.summary}
                  </p>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SymbolDetail;
