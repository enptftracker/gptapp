import React from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface CurrentPriceDisplayProps {
  ticker: string;
  className?: string;
  showChange?: boolean;
}

export function CurrentPriceDisplay({ ticker, className, showChange = true }: CurrentPriceDisplayProps) {
  const { data: marketData, isLoading } = useMarketData(ticker);

  if (isLoading) {
    return <span className={cn("text-muted-foreground", className)}>Loading...</span>;
  }

  if (!marketData) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const isPositive = (marketData.change || 0) >= 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-medium">{formatCurrency(marketData.price)}</span>
      {showChange && marketData.change !== undefined && (
        <span className={cn(
          "text-sm",
          isPositive ? "text-profit" : "text-loss"
        )}>
          {isPositive ? '+' : ''}{formatCurrency(marketData.change)} ({formatPercent(marketData.changePercent || 0)})
        </span>
      )}
    </div>
  );
}