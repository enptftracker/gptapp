import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Holding, ConsolidatedHolding } from '@/lib/types';

interface PerformanceBreakdownProps {
  holdings: Holding[] | ConsolidatedHolding[];
  title?: string;
  className?: string;
}

export function PerformanceBreakdown({ holdings, title = "Performance by Position", className }: PerformanceBreakdownProps) {
  const chartData = holdings
    .map(holding => {
      const pl = 'unrealizedPL' in holding ? holding.unrealizedPL :
                 ('totalUnrealizedPL' in holding ? holding.totalUnrealizedPL : 0);
      const plPercent = 'unrealizedPLPercent' in holding ? holding.unrealizedPLPercent :
                       ('totalUnrealizedPLPercent' in holding ? holding.totalUnrealizedPLPercent : 0);

      return {
        name: holding.symbol.ticker,
        pl,
        plPercent
      };
    })
    .sort((a, b) => Math.abs(b.pl) - Math.abs(a.pl))
    .slice(0, 10);

  const formatYAxisTick = (value: number) => {
    const absValue = Math.abs(value);

    if (absValue >= 1_000_000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1_000_000).toFixed(1)}M`;
    }

    if (absValue >= 1_000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1_000).toFixed(1)}k`;
    }

    if (absValue >= 1) {
      return `${value < 0 ? '-' : ''}$${absValue.toFixed(0)}`;
    }

    return `${value < 0 ? '-' : ''}$${absValue.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground mb-1">{data.name}</p>
          <p className={`text-sm ${data.pl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(data.pl)} ({formatPercent(data.plPercent)})
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No performance data available
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
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatYAxisTick}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pl >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-5))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
