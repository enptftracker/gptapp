import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  isPercentage?: boolean;
  isCurrency?: boolean;
  className?: string;
  currency?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changePercent,
  isPercentage = false,
  isCurrency = true,
  className,
  currency
}: MetricCardProps) {
  const { baseCurrency } = useCurrencyFormatter();
  const resolvedCurrency = currency ?? baseCurrency;
  const isPositive = (change ?? 0) >= 0;
  const hasChange = change !== undefined;

  const formatValue = (val: number) => {
    if (isPercentage) return formatPercent(val);
    if (isCurrency) return formatCurrency(val, resolvedCurrency);
    return val.toLocaleString();
  };

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{formatValue(value)}</p>
          
          {hasChange && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-profit" : "text-loss"
            )}>
              <span className={cn(
                "inline-flex h-1 w-1 rounded-full",
                isPositive ? "bg-profit" : "bg-loss"
              )} />
              {isCurrency && change !== undefined && formatCurrency(Math.abs(change), resolvedCurrency)}
              {changePercent !== undefined && (
                <span className="ml-1">({formatPercent(Math.abs(changePercent))})</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}