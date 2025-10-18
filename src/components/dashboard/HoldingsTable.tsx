import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Holding } from '@/lib/types';
import { InstrumentIcon } from '@/components/shared/InstrumentIcon';

export type LotMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';

export interface HoldingsTableProps {
  holdings: Holding[];
  className?: string;
  lotMethod?: LotMethod;
}

export default function HoldingsTable({ holdings, className, lotMethod }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 md:p-8 text-center">
        <p className="text-sm md:text-base text-muted-foreground">No holdings to display</p>
      </div>
    );
  }

  const buyPriceLabel = `Buy Price${lotMethod ? ` (${lotMethod})` : ''}`;

  return (
    <div className={cn('space-y-4', className)}>
      {holdings.map((holding) => {
        const isProfit = holding.unrealizedPL >= 0;
        const ticker = holding.symbol.ticker || '—';
        const name = holding.symbol.name || '—';
        const metadataParts = [holding.symbol.assetType, holding.symbol.exchange]
          .filter(Boolean)
          .map((part) => String(part));
        const metricRowClass =
          'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4';

        return (
          <Card key={`${holding.portfolioId}-${holding.symbolId}`} className="border-border/80">
            <CardHeader className="space-y-3 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:pb-5 sm:pt-5">
              <div className="flex min-w-0 items-start gap-3">
                <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold leading-tight">{ticker}</p>
                  <p className="truncate text-xs text-muted-foreground leading-tight">{name}</p>
                  {metadataParts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.625rem] text-muted-foreground/80">
                      {metadataParts.map((part, index) => (
                        <React.Fragment key={`${ticker}-${part}-${index}`}>
                          <span className="truncate">{part}</span>
                          {index < metadataParts.length - 1 && (
                            <span aria-hidden="true" className="text-muted-foreground/60">
                              •
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={metricRowClass}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quantity</div>
                  <div className="text-sm font-mono sm:text-right">{holding.quantity.toLocaleString()}</div>
                </div>
                <div className={metricRowClass}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{buyPriceLabel}</div>
                  <div className="text-sm font-mono sm:text-right">{formatCurrency(holding.avgCostBase)}</div>
                </div>
                <div className={metricRowClass}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Price</div>
                  <div className="text-sm font-mono sm:text-right">{formatCurrency(holding.currentPrice)}</div>
                </div>
                <div className={metricRowClass}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Market Value</div>
                  <div className="text-sm font-mono font-semibold sm:text-right">{formatCurrency(holding.marketValueBase)}</div>
                </div>
                <div className={`${metricRowClass} sm:col-span-2`}>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unrealized P/L</div>
                  <div
                    className={cn(
                      'flex flex-col items-start text-sm font-medium sm:items-end sm:text-right',
                      isProfit ? 'text-profit' : 'text-loss'
                    )}
                  >
                    <span className="font-mono">{formatCurrency(holding.unrealizedPL)}</span>
                    <span className="text-xs sm:text-sm">({formatPercent(holding.unrealizedPLPercent)})</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
