import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    <div className={cn("rounded-lg border overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-20 bg-background text-xs md:text-sm">Instrument</TableHead>
            <TableHead className="text-right text-xs md:text-sm">Quantity</TableHead>
            <TableHead className="text-right text-xs md:text-sm">{buyPriceLabel}</TableHead>
            <TableHead className="text-right text-xs md:text-sm">Current Price</TableHead>
            <TableHead className="text-right text-xs md:text-sm">Market Value</TableHead>
            <TableHead className="text-right text-xs md:text-sm">P/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((holding) => {
            const isProfit = holding.unrealizedPL >= 0;
            const ticker = holding.symbol.ticker || '—';
            const name = holding.symbol.name || '—';
            const metadataParts = [holding.symbol.assetType, holding.symbol.exchange]
              .filter(Boolean)
              .map((part) => String(part));

            return (
              <TableRow key={`${holding.portfolioId}-${holding.symbolId}`}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
                    <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0 space-y-0.5">
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
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm whitespace-nowrap">
                  {holding.quantity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm whitespace-nowrap">
                  {formatCurrency(holding.avgCostBase)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm whitespace-nowrap">
                  {formatCurrency(holding.currentPrice)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium text-xs md:text-sm whitespace-nowrap">
                  {formatCurrency(holding.marketValueBase)}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className={cn(
                      'flex flex-col text-xs md:text-sm font-medium',
                      isProfit ? 'text-profit' : 'text-loss'
                    )}
                  >
                    <span className="font-mono whitespace-nowrap">
                      {formatCurrency(holding.unrealizedPL)}
                    </span>
                    <span className="text-xs">
                      ({formatPercent(holding.unrealizedPLPercent)})
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
