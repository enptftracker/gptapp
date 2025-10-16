import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Holding } from '@/lib/types';
import { InstrumentIcon } from '@/components/shared/InstrumentIcon';

type LotMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';

interface HoldingsTableProps {
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
            const ticker = holding.symbol.ticker.toUpperCase();
            const name = holding.symbol.name || '—';
            const badgeParts = [holding.symbol.assetType, ticker, holding.symbol.exchange]
              .filter(Boolean)
              .map((part) => String(part).toUpperCase());
            const badgeLabel = badgeParts.length > 0 ? badgeParts.join(' · ') : ticker;

            return (
              <TableRow key={`${holding.portfolioId}-${holding.symbolId}`}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <div className="flex items-center gap-3 min-w-0">
                    <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium uppercase tracking-wide text-[0.75rem] md:text-sm truncate">{name}</p>
                      <Badge
                        variant="secondary"
                        className="mt-1 w-fit text-[0.6rem] uppercase tracking-wide"
                      >
                        {badgeLabel}
                      </Badge>
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
