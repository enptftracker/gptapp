import { ReactNode, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type Payload,
  type TooltipProps
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ABBREVIATION_UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'k' }
];

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function formatCurrencyTick(value: number): string {
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);

  for (const unit of ABBREVIATION_UNITS) {
    if (absoluteValue >= unit.value) {
      const truncated = Math.floor((absoluteValue / unit.value) * 10) / 10;
      const formattedNumber = Number.isInteger(truncated) ? truncated.toFixed(0) : truncated.toFixed(1);
      return `${isNegative ? '-' : ''}$${formattedNumber}${unit.suffix}`;
    }
  }

  const formatted = formatCurrency(value);
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
}

interface DataPoint {
  date: string;
  value: number;
  cost: number;
  isoDate?: string;
}

interface HistoricalValueChartProps {
  data: DataPoint[];
  title?: string;
  className?: string;
}

type TimeframeValue = '1D' | '1M' | '3M' | '1Y' | '3Y' | 'MAX';

const TIMEFRAME_OPTIONS: Array<{ label: string; value: TimeframeValue; days?: number }> = [
  { label: '1D', value: '1D', days: 1 },
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '1Y', value: '1Y', days: 365 },
  { label: '3Y', value: '3Y', days: 365 * 3 },
  { label: 'Max', value: 'MAX' }
];

const parseISODate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(part => Number.parseInt(part, 10));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

export function HistoricalValueChart({ data, title = 'Portfolio Value Over Time', className }: HistoricalValueChartProps) {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeValue>('MAX');

  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [] as DataPoint[];
    }

    if (timeframe === 'MAX') {
      return data;
    }

    const option = TIMEFRAME_OPTIONS.find(entry => entry.value === timeframe);
    if (!option?.days) {
      return data;
    }

    const lastPoint = data[data.length - 1];
    const lastDate = parseISODate(lastPoint.isoDate);
    if (!lastDate) {
      return data;
    }

    const startTime = lastDate.getTime() - (option.days * MS_IN_DAY);

    const filtered = data.filter(point => {
      const pointDate = parseISODate(point.isoDate);
      if (!pointDate) {
        return true;
      }
      return pointDate.getTime() >= startTime;
    });

    if (filtered.length >= 2) {
      return filtered;
    }

    if (data.length >= 2) {
      return data.slice(-2);
    }

    return filtered;
  }, [data, timeframe]);

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!(active && payload && payload.length)) {
      return null;
    }

    const tooltipItems = payload as Payload<number, string>[];
    const dataPoint = tooltipItems[0].payload as DataPoint;
    const pl = dataPoint.value - dataPoint.cost;
    const plPercent = dataPoint.cost !== 0 ? (pl / Math.abs(dataPoint.cost)) * 100 : 0;

    return (
      <div className="pointer-events-none rounded-lg border border-border/70 bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <p className="mb-1 font-medium text-card-foreground">{dataPoint.date}</p>
        <div className="space-y-1.5">
          {tooltipItems.map((entry, index) => {
            const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);

            return (
              <div
                key={`${entry.dataKey ?? entry.name ?? index}`}
                className="flex items-center justify-between gap-3 text-card-foreground"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                  {entry.name}
                </span>
                <span className="font-semibold">{formatCurrency(value)}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1">
            <span className="text-muted-foreground">P/L</span>
            <span className={cn('font-semibold', pl >= 0 ? 'text-profit' : 'text-loss')}>
              {formatCurrency(pl)} ({plPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (!processedData || processedData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No historical data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderLegendText = (value: string): ReactNode => (
    <span className="text-xs text-muted-foreground">{value}</span>
  );

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/60 p-1">
          {TIMEFRAME_OPTIONS.map(option => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 text-xs font-medium transition-colors',
                timeframe === option.value
                  ? 'bg-primary/10 text-primary shadow-inner'
                  : 'text-muted-foreground hover:text-card-foreground'
              )}
              onClick={() => setTimeframe(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{ top: 12, right: 24, left: 12, bottom: 16 }}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.35} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatCurrencyTick}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.4 }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4', strokeOpacity: 0.6 }}
                position={{ x: 16, y: 16 }}
                wrapperStyle={{ pointerEvents: 'none' }}
                contentStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
              />
              <Legend
                verticalAlign="bottom"
                height={32}
                iconType="plainline"
                formatter={value => renderLegendText(value)}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={hoveredLine === 'value' || hoveredLine === null ? 2.5 : 1.5}
                strokeOpacity={hoveredLine === 'value' || hoveredLine === null ? 1 : 0.35}
                name="Market Value"
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                onMouseEnter={() => setHoveredLine('value')}
                onMouseLeave={() => setHoveredLine(null)}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="hsl(var(--chart-4))"
                strokeWidth={hoveredLine === 'cost' || hoveredLine === null ? 2.5 : 1.5}
                strokeOpacity={hoveredLine === 'cost' || hoveredLine === null ? 1 : 0.35}
                strokeDasharray="5 5"
                name="Cumulative Deposits"
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                onMouseEnter={() => setHoveredLine('cost')}
                onMouseLeave={() => setHoveredLine(null)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
