import { useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { WatchlistItem } from '@/hooks/useWatchlist';
import { useMarketData } from '@/hooks/useMarketData';
import { InstrumentIcon } from '@/components/shared/InstrumentIcon';
import { cn } from '@/lib/utils';
import { StockChart } from './StockChart';

interface SymbolSummaryProps {
  item: WatchlistItem;
}

interface QuoteSummary {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated?: number;
  high?: number;
  low?: number;
}

export function SymbolSummary({ item }: SymbolSummaryProps) {
  const { data: liveData, isLoading, error } = useMarketData(item.symbol.ticker);
  const quoteCurrency = item.symbol.quote_currency || 'USD';

  const summary = useMemo<QuoteSummary | null>(() => {
    if (liveData) {
      return {
        price: liveData.price,
        change: liveData.change,
        changePercent: liveData.changePercent,
        lastUpdated: liveData.lastUpdated?.getTime(),
        high: liveData.high,
        low: liveData.low,
      };
    }

    return null;
  }, [liveData]);

  const isPositive = (summary?.change ?? 0) >= 0;

  const currencyFormatter = useMemo(() => (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: quoteCurrency,
      minimumFractionDigits: 2,
    })
  ), [quoteCurrency]);

  const formattedLastUpdated = summary?.lastUpdated
    ? `${format(new Date(summary.lastUpdated), 'PPpp')} (${formatDistanceToNow(new Date(summary.lastUpdated), { addSuffix: true })})`
    : 'Live market data unavailable';

  const formatDelta = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  };

  const formatCurrencyValue = (value?: number | null) => {
    if (typeof value === 'number') {
      return currencyFormatter.format(value);
    }
    return 'Not available';
  };

  const highValue = summary?.high;
  const lowValue = summary?.low;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <InstrumentIcon ticker={item.symbol.ticker} name={item.symbol.name} size="lg" />
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              {item.symbol.name || item.symbol.ticker}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{item.symbol.ticker}</Badge>
              <Badge variant="outline">{item.symbol.asset_type}</Badge>
              <span>{formattedLastUpdated}</span>
            </div>
          </div>
        </div>

        {summary && (
          <div className="text-right">
            <p className="text-3xl font-bold">
              {currencyFormatter.format(summary.price)}
            </p>
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
                isPositive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              )}
            >
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{formatDelta(summary.change)}</span>
              <span className="text-xs text-muted-foreground">({formatDelta(summary.changePercent)}%)</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Source: Live market data</p>
          </div>
        )}
      </CardHeader>
      <div className="px-6 pb-6">
        <StockChart
          ticker={item.symbol.ticker}
          currency={quoteCurrency}
          standalone={false}
        />
      </div>
      <CardContent className="space-y-4 pt-0">
        {isLoading && !summary ? (
          <Skeleton className="h-24 w-full" />
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Asset type</p>
              <p className="text-sm font-semibold">{item.symbol.asset_type}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Quote currency</p>
              <p className="text-sm font-semibold">{quoteCurrency}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">24h change</p>
              <p className="text-sm font-semibold">{currencyFormatter.format(Math.abs(summary.change))}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">24h change (%)</p>
              <p className="text-sm font-semibold">{formatDelta(summary.changePercent)}%</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">24h high</p>
              <p className="text-sm font-semibold text-success">{formatCurrencyValue(highValue)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">24h low</p>
              <p className="text-sm font-semibold text-destructive">{formatCurrencyValue(lowValue)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            Live price data is unavailable for this symbol right now. Please try again later.
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error
                ? error.message
                : 'Unable to load live market data at the moment. Please try again later.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default SymbolSummary;
