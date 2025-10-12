import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useHistoricalPrices, useMarketData } from '@/hooks/useMarketData';
import type { HistoricalRange } from '@/lib/marketData';
import { WatchlistItem } from '@/hooks/useWatchlist';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingDown, TrendingUp, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InstrumentIcon } from '@/components/shared/InstrumentIcon';

const rangeOptions: HistoricalRange[] = ['1D', '1W', '1M', '3M', '1Y', '5Y', 'MAX'];

const rangeDisplayFormat: Record<HistoricalRange, string> = {
  '1D': 'HH:mm',
  '1W': 'MMM d',
  '1M': 'MMM d',
  '3M': 'MMM d',
  '6M': 'MMM d',
  '1Y': 'MMM yyyy',
  '5Y': 'MMM yyyy',
  'MAX': 'yyyy',
};

const rangeTooltipFormat: Record<HistoricalRange, string> = {
  '1D': 'MMM d, HH:mm',
  '1W': 'EEE, MMM d yyyy',
  '1M': 'EEE, MMM d yyyy',
  '3M': 'EEE, MMM d yyyy',
  '6M': 'MMM d yyyy',
  '1Y': 'MMM d yyyy',
  '5Y': 'MMM yyyy',
  'MAX': 'MMM yyyy',
};

function formatPrice(price: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

function formatDelta(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

interface SymbolSummaryProps {
  item: WatchlistItem;
}

export function SymbolSummary({ item }: SymbolSummaryProps) {
  const [range, setRange] = useState<HistoricalRange>('1M');
  const { data: marketData, isLoading: isPriceLoading } = useMarketData(item.symbol.ticker);
  const { data: historicalPrices = [], isLoading: isHistoryLoading } = useHistoricalPrices(item.symbol.ticker, range);

  const latestPrice = marketData?.price ?? item.price?.price;
  const change = marketData?.change ?? item.price?.change_24h ?? 0;
  const changePercent = marketData?.changePercent ?? item.price?.change_percent_24h ?? 0;
  const quoteCurrency = item.symbol.quote_currency || 'USD';

  const chartData = useMemo(
    () =>
      historicalPrices.map((point) => ({
        date: format(new Date(point.time), rangeDisplayFormat[range]),
        iso: point.time,
        price: Number(point.price.toFixed(2)),
      })),
    [historicalPrices, range]
  );

  const rangeLow = historicalPrices.length ? Math.min(...historicalPrices.map((point) => point.price)) : null;
  const rangeHigh = historicalPrices.length ? Math.max(...historicalPrices.map((point) => point.price)) : null;
  const isPositive = change >= 0;

  return (
    <Card className="h-full lg:min-h-[560px]">
      <CardHeader className="space-y-6">
        <div className="flex items-start gap-4">
          <InstrumentIcon ticker={item.symbol.ticker} name={item.symbol.name} size="lg" />
          <div className="space-y-1">
            <CardTitle className="text-xl">{item.symbol.ticker}</CardTitle>
            <p className="text-sm text-muted-foreground">{item.symbol.name}</p>
            <Badge variant="secondary" className="w-fit">
              {item.symbol.asset_type}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <div className="text-3xl font-bold">
            {latestPrice !== undefined ? formatPrice(latestPrice, quoteCurrency) : '--'}
          </div>
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
              isPositive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            )}
          >
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{formatDelta(change)}</span>
            <span className="text-xs text-muted-foreground">({formatDelta(changePercent)}%)</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Time range</span>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => {
              if (!value) return;
              setRange(value as HistoricalRange);
            }}
            className="flex flex-wrap gap-2"
          >
            {rangeOptions.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="px-3 py-1 text-xs"
              >
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-[320px]">
          {isHistoryLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`summaryGradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" minTickGap={16} />
                <YAxis className="text-xs" domain={['auto', 'auto']} width={60} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value: number) => [formatPrice(Number(value), quoteCurrency), 'Price']}
                  labelFormatter={(_, payload) => {
                    const iso = payload?.[0]?.payload?.iso as string | undefined;
                    if (!iso) return '';
                    return format(new Date(iso), rangeTooltipFormat[range]);
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill={`url(#summaryGradient-${item.id})`}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No historical data available
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Range high</p>
            <p className="font-mono text-lg font-semibold">
              {rangeHigh ? formatPrice(rangeHigh, quoteCurrency) : '--'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Range low</p>
            <p className="font-mono text-lg font-semibold">
              {rangeLow ? formatPrice(rangeLow, quoteCurrency) : '--'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Latest update</p>
            <p className="text-sm text-muted-foreground">
              {isPriceLoading ? 'Refreshing quote…' : 'Based on recent market data'}
            </p>
          </div>
        </div>

        <Button variant="outline" className="w-full" asChild>
          <Link
            to={`/symbol/${item.symbol.ticker}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full symbol details
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default SymbolSummary;
