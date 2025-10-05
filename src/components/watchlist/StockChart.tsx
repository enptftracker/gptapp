import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface StockChartProps {
  ticker: string;
  currency: string;
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '5Y';

export function StockChart({ ticker, currency }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

  // Generate mock historical data
  const generateMockData = (range: TimeRange) => {
    const today = new Date();
    let days = 365;
    
    switch (range) {
      case '1M': days = 30; break;
      case '3M': days = 90; break;
      case '6M': days = 180; break;
      case '1Y': days = 365; break;
      case '5Y': days = 1825; break;
    }

    // Use realistic base price (e.g., $500 for SPY-like stocks)
    const basePrice = 500;
    const data = [];
    let currentPrice = basePrice;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Realistic daily price movement (typically -2% to +2%)
      const dailyChangePercent = (Math.random() - 0.45) * 2; // Slight upward bias
      const dailyChange = currentPrice * (dailyChangePercent / 100);
      currentPrice = Math.max(basePrice * 0.8, currentPrice + dailyChange); // Don't drop below 80% of base
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: parseFloat(currentPrice.toFixed(2))
      });
    }
    
    return data;
  };

  const data = generateMockData(timeRange);
  const minPrice = Math.min(...data.map(d => d.price));
  const maxPrice = Math.max(...data.map(d => d.price));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{payload[0].payload.date}</p>
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
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
