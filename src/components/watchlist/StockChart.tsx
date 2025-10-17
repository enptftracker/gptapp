import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/calculations';
import { useHistoricalPrices } from '@/hooks/useMarketData';
import type { HistoricalRange } from '@/lib/marketData';

interface StockChartProps {
  ticker: string;
  currency: string;
}

type TimeRange = '1D' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';

const rangeDisplayFormat: Record<HistoricalRange, string> = {
  '1D': 'HH:mm',
  '1M': 'MMM d',
  '3M': 'MMM d',
  '1Y': 'MMM yyyy',
  '5Y': 'MMM yyyy',
  'MAX': 'yyyy',
};

const rangeTooltipFormat: Record<HistoricalRange, string> = {
  '1D': 'MMM d, HH:mm',
  '1M': 'EEE, MMM d yyyy',
  '3M': 'EEE, MMM d yyyy',
  '1Y': 'MMM d yyyy',
  '5Y': 'MMM yyyy',
  'MAX': 'MMM yyyy',
};

const rangeMap: Record<TimeRange, HistoricalRange> = {
  '1D': '1D',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1Y',
  '5Y': '5Y',
  'MAX': 'MAX',
};

export function StockChart({ ticker, currency }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);

  const historicalRange = rangeMap[timeRange];
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isSuccess,
  } = useHistoricalPrices(ticker, historicalRange);

  const historicalPrices = useMemo(() => data ?? [], [data]);

  const chartData = useMemo(
    () =>
      historicalPrices.map((point) => ({
        timestamp: point.timestamp,
        iso: point.time,
        price: Number(point.price.toFixed(2)),
      })),
    [historicalPrices]
  );

  const showNoData = isSuccess && historicalPrices.length === 0;

  const prices = historicalPrices.map(point => point.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    useEffect(() => {
      if (active && payload && payload.length) {
        const defaultKey = payload[0]?.dataKey as string | undefined;
        if (defaultKey && hoveredSeries === null) {
          setHoveredSeries(defaultKey);
        }
      } else if (!active && hoveredSeries !== null) {
        setHoveredSeries(null);
      }
    }, [active, hoveredSeries, payload]);

    if (active && payload && payload.length) {
      const iso = payload[0]?.payload?.iso as string | undefined;
      const label = iso ? format(new Date(iso), rangeTooltipFormat[historicalRange]) : payload[0].payload.date;
      const key = payload[0]?.dataKey as string | undefined;
      return (
        <div
          className="bg-card border border-border rounded-lg p-2 shadow-lg"
          onMouseEnter={() => key && setHoveredSeries(key)}
          onMouseLeave={() => key && setHoveredSeries(key)}
        >
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-card-foreground">
            {formatCurrency(Number(firstPayload?.value ?? 0), currency)}
          </p>
        </div>
      );
    }
    return null;
  }, [currency, historicalRange]);

  const priceRange = maxPrice - minPrice;
  const showTwoDecimals = priceRange < 5 || maxPrice < 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base md:text-lg">Price History</CardTitle>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['1D', '1M', '3M', '1Y', '5Y', 'MAX'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs px-2 md:px-3 flex-shrink-0"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48 md:h-64">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : isError && error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <p>Unable to load historical data.</p>
              <p className="text-[11px] text-destructive">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                onMouseLeave={() => setHoveredSeries(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={xTickFormatter}
                  minTickGap={20}
                />
                <YAxis
                  domain={[minPrice * 0.98, maxPrice * 1.02]}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `${value.toFixed(showTwoDecimals ? 2 : 0)}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={hoveredSeries === 'price' || hoveredSeries === null ? 2.5 : 1.5}
                  strokeOpacity={hoveredSeries === 'price' || hoveredSeries === null ? 1 : 0.4}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : showNoData ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No historical data available
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
