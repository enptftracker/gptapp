import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
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

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '5Y';

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

const rangeMap: Record<TimeRange, HistoricalRange> = {
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  '1Y': '1Y',
  '5Y': '5Y',
};

export function StockChart({ ticker, currency }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

  const historicalRange = rangeMap[timeRange];
  const { data: historicalPrices = [], isLoading } = useHistoricalPrices(ticker, historicalRange);

  const data = useMemo(
    () =>
      historicalPrices.map((point) => ({
        date: format(new Date(point.time), rangeDisplayFormat[historicalRange]),
        iso: point.time,
        price: Number(point.price.toFixed(2)),
      })),
    [historicalPrices, historicalRange]
  );

  const prices = historicalPrices.map(point => point.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const iso = payload[0]?.payload?.iso as string | undefined;
      const label = iso ? format(new Date(iso), rangeTooltipFormat[historicalRange]) : payload[0].payload.date;
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-card-foreground">
            {formatCurrency(payload[0].value, currency)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base md:text-lg">Price History</CardTitle>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['1M', '3M', '6M', '1Y', '5Y'] as TimeRange[]).map((range) => (
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
          ) : data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minPrice * 0.98, maxPrice * 1.02]}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No historical data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
