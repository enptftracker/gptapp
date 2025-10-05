import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  isPercentage?: boolean;
  isCurrency?: boolean;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  changePercent,
  isPercentage = false,
  isCurrency = true,
  className
}: MetricCardProps) {
  const isPositive = (change ?? 0) >= 0;
  const hasChange = change !== undefined;

  const formatValue = (val: number) => {
    if (isPercentage) return formatPercent(val);
    if (isCurrency) return formatCurrency(val);
    return val.toLocaleString();
  };

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-3 md:p-4">
        <div className="space-y-1 md:space-y-2">
          <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-lg md:text-2xl font-bold tracking-tight">{formatValue(value)}</p>
          
          {hasChange && (
            <div className={cn(
              "flex items-center gap-1 text-xs md:text-sm font-medium",
              isPositive ? "text-profit" : "text-loss"
            )}>
              <span className={cn(
                "inline-flex h-1 w-1 rounded-full flex-shrink-0",
                isPositive ? "bg-profit" : "bg-loss"
              )} />
              {isCurrency && change !== undefined && <span className="truncate">{formatCurrency(Math.abs(change))}</span>}
              {changePercent !== undefined && (
                <span className="ml-1 truncate">({formatPercent(Math.abs(changePercent))})</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
