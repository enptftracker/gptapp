import { useState } from 'react';
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

const ABBREVIATION_UNITS = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'k' }
];

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
}

interface HistoricalValueChartProps {
  data: DataPoint[];
  title?: string;
  className?: string;
}

export function HistoricalValueChart({ data, title = "Portfolio Value Over Time", className }: HistoricalValueChartProps) {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!(active && payload && payload.length)) {
      return null;
    }

    const tooltipItems = payload as Payload<number, string>[];
    const dataPoint = tooltipItems[0].payload as DataPoint;
    const pl = dataPoint.value - dataPoint.cost;
    const plPercent = dataPoint.cost > 0 ? ((pl / dataPoint.cost) * 100).toFixed(2) : '0.00';

    return (
      <div className="pointer-events-none rounded-md border border-border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
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
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                  {entry.name}
                </span>
                <span className="font-medium">{formatCurrency(value)}</span>
              </div>
            );
          })}
          <p className={`font-medium ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
            P/L: {formatCurrency(pl)} ({plPercent}%)
          </p>
        </div>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No historical data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatCurrencyTick}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={false}
                position={{ x: 16, y: 16 }}
                wrapperStyle={{ pointerEvents: 'none' }}
                contentStyle={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--chart-1))"
                strokeWidth={hoveredLine === 'value' || hoveredLine === null ? 2.5 : 1.5}
                strokeOpacity={hoveredLine === 'value' || hoveredLine === null ? 1 : 0.35}
                name="Market Value"
                dot={false}
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
                name="Cost Basis"
                dot={false}
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
