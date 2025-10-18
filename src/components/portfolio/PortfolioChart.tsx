import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding, ConsolidatedHolding } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { useResizeObserver } from '@/hooks/useResizeObserver';

interface PortfolioChartProps {
  holdings: Holding[] | ConsolidatedHolding[];
  title?: string;
  className?: string;
}

// Professional color palette for financial charts
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-1) / 0.6)',
  'hsl(var(--chart-2) / 0.6)',
  'hsl(var(--chart-3) / 0.6)',
  'hsl(var(--chart-4) / 0.6)',
  'hsl(var(--chart-5) / 0.6)',
];

interface ChartData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export default function PortfolioChart({ holdings, title = "Portfolio Allocation", className }: PortfolioChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartData: ChartData[] = holdings
    .filter(holding => {
      // Handle both Holding and ConsolidatedHolding types
      const value = 'marketValueBase' in holding ? holding.marketValueBase : holding.totalMarketValue;
      return value > 0;
    })
    .map((holding, index) => {
      const value = 'marketValueBase' in holding ? holding.marketValueBase : holding.totalMarketValue;
      const allocation = 'allocationPercent' in holding ? holding.allocationPercent : 0;
      
      return {
        name: holding.symbol.ticker,
        value,
        percentage: allocation,
        color: CHART_COLORS[index % CHART_COLORS.length]
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Show top 10 holdings

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground">{data.name}</p>
          <p className="text-sm text-primary">
            Value: {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-muted-foreground">
            Allocation: {formatPercent(data.percentage)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {payload?.slice(0, 8).map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1 text-xs">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const { ref: containerRef, width, height } = useResizeObserver<HTMLDivElement>();
  const chartMargin = 16;
  const marginOffset = chartMargin * 2;
  const safeWidth = Math.max(width - marginOffset, 0);
  const safeHeight = Math.max(height - marginOffset, 0);
  const minDimension = Math.min(safeWidth, safeHeight);
  const computedOuterRadius = minDimension > 0 ? (minDimension / 2) * 0.8 : undefined;
  const computedInnerRadius = computedOuterRadius ? computedOuterRadius * 0.6 : undefined;

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No holdings data available
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
        <div className="pt-4">
          <div
            ref={containerRef}
            className="h-64 w-full md:h-72 lg:h-80 flex items-center justify-center"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: chartMargin, right: chartMargin, bottom: chartMargin, left: chartMargin }}>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={computedInnerRadius ?? '45%'}
                  outerRadius={computedOuterRadius ?? '80%'}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top holdings list */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Top Holdings</h4>
          {chartData.slice(0, 5).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="text-right">
                <div className="font-mono">{formatCurrency(item.value)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatPercent(item.percentage)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
