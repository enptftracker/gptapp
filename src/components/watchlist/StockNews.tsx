import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useSymbolNews } from '@/hooks/useSymbolNews';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface StockNewsProps {
  ticker: string;
}

export function StockNews({ ticker }: StockNewsProps) {
  const {
    data: newsItems,
    isLoading,
    error
  } = useSymbolNews(ticker);

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
          {error && (
            <p className="text-xs text-muted-foreground">
              Displaying fallback headlines while live data loads.
            </p>
          )}
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))
            : newsItems.map((news) => {
                const sentiment = news.sentiment ?? 'neutral';
                const summary = news.summary?.trim()
                  ? news.summary
                  : `Stay up to date on ${ticker} with the latest coverage.`;

                return (
                  <a
                    key={`${news.url}-${news.publishedAt}`}
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
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span>{news.publisher}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(news.publishedAt), { addSuffix: true })}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{summary}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`${getSentimentColor(sentiment)} text-xs px-1.5 py-0.5`}
                        >
                          <span className="flex items-center gap-1">
                            {getSentimentIcon(sentiment)}
                            <span className="capitalize">{sentiment}</span>
                          </span>
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </a>
                );
              })}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          News data is for demonstration purposes only
        </p>
      </CardContent>
    </Card>
  );
}
