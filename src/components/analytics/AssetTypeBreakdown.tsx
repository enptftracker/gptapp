import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Holding, ConsolidatedHolding } from '@/lib/types';

interface AssetTypeBreakdownProps {
  holdings: Holding[] | ConsolidatedHolding[];
  title?: string;
  className?: string;
}

const ASSET_COLORS: Record<string, string> = {
  EQUITY: 'hsl(var(--chart-1))',
  ETF: 'hsl(var(--chart-2))',
  CRYPTO: 'hsl(var(--chart-3))',
  BOND: 'hsl(var(--chart-4))',
  COMMODITY: 'hsl(var(--chart-5))',
  FOREX: 'hsl(var(--chart-2) / 0.7)',
};

export function AssetTypeBreakdown({ holdings, title = "Asset Allocation by Type", className }: AssetTypeBreakdownProps) {
  const assetTypeData = holdings.reduce((acc, holding) => {
    const assetType = holding.symbol.assetType;
    const value = 'marketValueBase' in holding ? holding.marketValueBase : holding.totalMarketValue;
    
    if (!acc[assetType]) {
      acc[assetType] = { value: 0, count: 0 };
    }
    acc[assetType].value += value;
    acc[assetType].count += 1;
    return acc;
  }, {} as Record<string, { value: number; count: number }>);

  const totalValue = Object.values(assetTypeData).reduce((sum, item) => sum + item.value, 0);

  const chartData = Object.entries(assetTypeData).map(([type, data]) => ({
    name: type,
    value: data.value,
    count: data.count,
    percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
    color: ASSET_COLORS[type] || 'hsl(var(--primary) / 0.6)'
  })).sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground">{data.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-primary">
              Value: {formatCurrency(data.value)}
            </p>
            <p className="text-muted-foreground">
              Allocation: {formatPercent(data.percentage)}
            </p>
            <p className="text-muted-foreground">
              Positions: {data.count}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap gap-3 justify-center mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground font-medium">{entry.value}</span>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No asset data available
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
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={false}
                labelLine={false}
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
        
        {/* Summary list */}
        <div className="mt-4 space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">({item.count} positions)</span>
              </div>
              <div className="text-right">
                <div className="font-mono font-medium">{formatCurrency(item.value)}</div>
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
