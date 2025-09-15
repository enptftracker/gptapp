import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';
import { Holding } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface AllocationChartProps {
  holdings: Holding[];
}

const COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#0ea5e9',
  '#14b8a6',
  '#ef4444'
];

interface TooltipPayload {
  value: number;
  payload: {
    name: string;
    value: number;
    allocation: number;
    currentPrice: number;
    currency: string;
  };
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div className="rounded-md border bg-background/95 px-3 py-2 shadow-lg">
      <p className="font-semibold">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        Market value: {formatCurrency(data.value)}
      </p>
      <p className="text-sm text-muted-foreground">
        Allocation: {formatPercent(data.allocation)}
      </p>
      <p className="text-sm text-muted-foreground">
        Price: {formatCurrency(data.currentPrice, data.currency)}
      </p>
    </div>
  );
};

const AllocationChart: React.FC<AllocationChartProps> = ({ holdings }) => {
  if (holdings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No holdings to display
      </div>
    );
  }

  const chartData = holdings.map((holding) => ({
    name: holding.symbol.ticker,
    value: holding.marketValueBase,
    allocation: holding.allocationPercent,
    currentPrice: holding.currentPrice,
    currency: holding.symbol.quoteCurrency
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={4}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default AllocationChart;
