import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding, ConsolidatedHolding } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface PortfolioChartProps {
  holdings: Holding[] | ConsolidatedHolding[];
  title?: string;
  className?: string;
}

// Professional color palette for financial charts
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--profit))',
  'hsl(var(--warning))',
  'hsl(var(--loss))',
  'hsl(var(--secondary))',
  'hsl(220 60% 65%)',
  'hsl(142 60% 65%)',
  'hsl(38 60% 65%)',
  'hsl(0 60% 75%)',
  'hsl(220 30% 75%)',
];

interface ChartData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export default function PortfolioChart({ holdings, title = "Portfolio Allocation", className }: PortfolioChartProps) {
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
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
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