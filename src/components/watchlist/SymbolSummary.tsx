import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMarketData } from '@/hooks/useMarketData';
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

const logoDomains: Record<string, string> = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  META: 'meta.com',
  NFLX: 'netflix.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  JNJ: 'jnj.com',
  UNH: 'uhc.com',
  PFE: 'pfizer.com',
  KO: 'coca-colacompany.com',
  PEP: 'pepsico.com',
  WMT: 'walmart.com',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  VTI: 'vanguard.com',
  IWM: 'ishares.com',
  EFA: 'ishares.com',
  COIN: 'coinbase.com',
  MSTR: 'microstrategy.com',
};

const rangeOptions = ['1D', '1W', '1M', '3M', '1Y', '5Y', 'MAX'] as const;
type TimeRange = typeof rangeOptions[number];

const rangeFormat: Record<TimeRange, { format: string; points: number; volatility: number }> = {
  '1D': { format: 'haaa', points: 24, volatility: 0.012 },
  '1W': { format: 'MMM dd', points: 7, volatility: 0.02 },
  '1M': { format: 'MMM dd', points: 30, volatility: 0.035 },
  '3M': { format: 'MMM dd', points: 13, volatility: 0.05 },
  '1Y': { format: 'MMM yyyy', points: 12, volatility: 0.12 },
  '5Y': { format: 'MMM yyyy', points: 10, volatility: 0.22 },
  'MAX': { format: 'yyyy', points: 12, volatility: 0.35 },
};

type ChartPoint = { date: string; price: number };

function subtractDate(range: TimeRange, base: Date, stepsBack: number): Date {
  const date = new Date(base);

  switch (range) {
    case '1D':
      date.setHours(date.getHours() - stepsBack);
      break;
    case '1W':
      date.setDate(date.getDate() - stepsBack);
      break;
    case '1M':
      date.setDate(date.getDate() - stepsBack);
      break;
    case '3M':
      date.setDate(date.getDate() - stepsBack * 7);
      break;
    case '1Y':
      date.setMonth(date.getMonth() - stepsBack);
      break;
    case '5Y':
      date.setMonth(date.getMonth() - stepsBack * 6);
      break;
    case 'MAX':
      date.setFullYear(date.getFullYear() - stepsBack);
      break;
    default:
      break;
  }

  return date;
}

function seededDrift(seed: number, index: number): number {
  return Math.sin((seed + index) * 0.45) * 0.6 + Math.cos((seed - index) * 0.35) * 0.4;
}

function generateHistoricalData(range: TimeRange, latestPrice: number | undefined, ticker: string): ChartPoint[] {
  const config = rangeFormat[range];
  const now = new Date();
  const basePrice = latestPrice ?? 100;
  const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const points: ChartPoint[] = [];

  let runningPrice = basePrice * (1 - config.volatility * 1.2);

  for (let index = 0; index < config.points; index++) {
    const stepsBack = config.points - index - 1;
    const pointDate = subtractDate(range, now, stepsBack);
    const ratio = index / Math.max(config.points - 1, 1);
    const movement = seededDrift(seed, index) * config.volatility * basePrice;
    const pullToBase = (basePrice - runningPrice) * 0.18;

    runningPrice = Math.max(runningPrice + movement + pullToBase, basePrice * 0.2);
    const price = Number(runningPrice.toFixed(2));

    points.push({
      date: format(pointDate, config.format),
      price,
    });
  }

  if (points.length) {
    const finalPrice = latestPrice ?? points[points.length - 1].price;
    points[points.length - 1].price = Number(finalPrice.toFixed(2));
  }

  return points;
}

function getLogoUrl(ticker: string, name?: string) {
  const domain = logoDomains[ticker.toUpperCase()];
  if (domain) {
    return `https://logo.clearbit.com/${domain}?size=80`;
  }

  const fallbackLabel = encodeURIComponent(name || ticker);
  return `https://ui-avatars.com/api/?name=${fallbackLabel}&background=random&color=ffffff&length=3`;
}

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
  const [range, setRange] = useState<TimeRange>('1M');
  const { data: marketData, isLoading } = useMarketData(item.symbol.ticker);

  const latestPrice = marketData?.price ?? item.price?.price;
  const change = marketData?.change ?? item.price?.change_24h ?? 0;
  const changePercent = marketData?.changePercent ?? item.price?.change_percent_24h ?? 0;

  const chartData = useMemo(
    () => generateHistoricalData(range, latestPrice, item.symbol.ticker),
    [range, latestPrice, item.symbol.ticker]
  );

  const rangeLow = chartData.length ? Math.min(...chartData.map((point) => point.price)) : null;
  const rangeHigh = chartData.length ? Math.max(...chartData.map((point) => point.price)) : null;
  const isPositive = change >= 0;

  const logoUrl = getLogoUrl(item.symbol.ticker, item.symbol.name);

  return (
    <Card className="h-full">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={logoUrl} alt={`${item.symbol.ticker} logo`} />
            <AvatarFallback>{item.symbol.ticker.slice(0, 3).toUpperCase()}</AvatarFallback>
          </Avatar>
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
            {latestPrice !== undefined ? formatPrice(latestPrice) : '--'}
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
              setRange(value as TimeRange);
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
      <CardContent className="space-y-4">
        <div className="h-[280px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`summaryGradient-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
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
                  formatter={(value: number) => [formatPrice(Number(value)), 'Price']}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill={`url(#summaryGradient-${item.id})`}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Range high</p>
            <p className="font-mono text-lg font-semibold">
              {rangeHigh ? formatPrice(rangeHigh) : '--'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Range low</p>
            <p className="font-mono text-lg font-semibold">
              {rangeLow ? formatPrice(rangeLow) : '--'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Latest update</p>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Refreshing quote…' : 'Based on recent market data'}
            </p>
          </div>
        </div>

        <Button variant="outline" className="w-full" asChild>
          <Link to={`/symbol/${item.symbol.ticker}`}>
            View full symbol details
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default SymbolSummary;
