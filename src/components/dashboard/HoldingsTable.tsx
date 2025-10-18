import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const [expandedHoldings, setExpandedHoldings] = useState<Record<string, boolean>>({});

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
        const holdingKey = `${holding.portfolioId}-${holding.symbolId}`;
        const metricsId = `holding-metrics-${holdingKey}`;
        const isExpanded = expandedHoldings[holdingKey] ?? false;

        const toggleExpanded = () =>
          setExpandedHoldings((prev) => ({
            ...prev,
            [holdingKey]: !isExpanded,
          }));

        return (
          <Card
            key={`${holding.portfolioId}-${holding.symbolId}`}
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                aria-controls={metricsId}
                className="flex w-full flex-col gap-4 bg-gradient-to-r from-primary/15 to-transparent px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0 space-y-2">
                      <div className="space-y-1">
                        <p className="truncate text-sm font-semibold leading-tight text-foreground">{ticker}</p>
                        <p className="truncate text-xs text-muted-foreground leading-tight">{name}</p>
                      </div>
                      {metadataParts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {metadataParts.map((part, index) => (
                            <Badge
                              key={`${ticker}-${part}-${index}`}
                              variant="secondary"
                              className="h-6 rounded-full px-2 text-[0.65rem] font-medium"
                            >
                              {part}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:items-end sm:text-right">
                    <div className="flex flex-col items-start gap-1 text-left sm:items-end sm:text-right">
                      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Market Value
                      </span>
                      <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                        {formatCurrency(holding.marketValueBase)}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium sm:text-sm',
                          isProfit ? 'text-profit' : 'text-loss'
                        )}
                      >
                        {formatPercent(holding.unrealizedPLPercent)}
                      </span>
                    </div>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200',
                        isExpanded ? 'rotate-180' : 'rotate-0'
                      )}
                    />
                  </div>
                </div>
              </button>
            </CardHeader>
            {isExpanded && (
              <CardContent className="p-0" id={metricsId}>
                <div className="grid grid-cols-1 gap-3 sm:divide-y sm:divide-border/80 sm:gap-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quantity</span>
                    <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                      {holding.quantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{buyPriceLabel}</span>
                    <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                      {formatCurrency(holding.avgCostBase)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Price</span>
                    <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                      {formatCurrency(holding.currentPrice)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Market Value</span>
                    <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                      {formatCurrency(holding.marketValueBase)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5 sm:py-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unrealized P/L</span>
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold sm:text-sm',
                          isProfit ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                        )}
                      >
                        {formatCurrency(holding.unrealizedPL)}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs font-medium sm:text-sm',
                          isProfit ? 'text-profit' : 'text-loss'
                        )}
                      >
                        {formatPercent(holding.unrealizedPLPercent)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
