import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface StockNewsProps {
  ticker: string;
}

export function StockNews({ ticker }: StockNewsProps) {
  // Mock news data - in production, fetch from a news API
  const encodedTicker = encodeURIComponent(`${ticker} stock`);
  const mockNews = [
    {
      id: 1,
      title: `${ticker} Reports Strong Q4 Earnings, Beats Estimates`,
      source: 'Financial Times',
      time: '2 hours ago',
      sentiment: 'positive',
      url: `https://www.ft.com/search?q=${encodedTicker}&sort=relevance`
    },
    {
      id: 2,
      title: `Analysts Upgrade ${ticker} Price Target Following Innovation Announcement`,
      source: 'Bloomberg',
      time: '5 hours ago',
      sentiment: 'positive',
      url: `https://www.bloomberg.com/quote/${ticker}:US`
    },
    {
      id: 3,
      title: `Market Watch: ${ticker} Navigates Industry Headwinds`,
      source: 'Reuters',
      time: '1 day ago',
      sentiment: 'neutral',
      url: `https://www.reuters.com/markets/companies/${ticker}`
    },
    {
      id: 4,
      title: `${ticker} Announces Strategic Partnership to Expand Market Reach`,
      source: 'CNBC',
      time: '2 days ago',
      sentiment: 'positive',
      url: `https://www.cnbc.com/quotes/${ticker}`
    },
    {
      id: 5,
      title: `Industry Analysis: ${ticker} Positioned for Long-term Growth`,
      source: 'Wall Street Journal',
      time: '3 days ago',
      sentiment: 'positive',
      url: `https://www.wsj.com/market-data/quotes/${ticker}`
    }
  ];

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'negative':
        return <TrendingDown className="h-3 w-3 text-destructive" />;
      default:
        return <AlertCircle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-success/10 text-success border-success/20';
      case 'negative':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Latest News</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockNews.map((news) => (
            <a
              key={news.id}
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {news.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground">{news.source}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{news.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={`${getSentimentColor(news.sentiment)} text-xs px-1.5 py-0.5`}>
                    {getSentimentIcon(news.sentiment)}
                  </Badge>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          News data is for demonstration purposes only
        </p>
      </CardContent>
    </Card>
  );
}
