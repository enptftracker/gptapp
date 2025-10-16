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
            <TableHead className="text-xs md:text-sm">Ticker</TableHead>
            <TableHead className="text-xs md:text-sm">Instrument</TableHead>
            <TableHead className="text-right text-xs md:text-sm">Quantity</TableHead>
            <TableHead className="text-right text-xs md:text-sm hidden sm:table-cell">{buyPriceLabel}</TableHead>
            <TableHead className="text-right text-xs md:text-sm hidden sm:table-cell">Current Price</TableHead>
            <TableHead className="text-right text-xs md:text-sm">Market Value</TableHead>
            <TableHead className="text-right text-xs md:text-sm">P/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((holding) => {
            const isProfit = holding.unrealizedPL >= 0;
            const ticker = holding.symbol.ticker.toUpperCase();
            const name = holding.symbol.name || '—';

            return (
              <TableRow key={`${holding.portfolioId}-${holding.symbolId}`}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm md:text-base">{holding.symbol.ticker}</span>
                    <Badge
                      variant="outline"
                      className="w-fit text-xs"
                    >
                      {holding.symbol.assetType}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-0">
                    <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">{name}</p>
                      {holding.symbol.exchange && (
                        <p className="text-xs text-muted-foreground truncate">
                          {holding.symbol.exchange}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm whitespace-nowrap">
                  {holding.quantity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm hidden sm:table-cell whitespace-nowrap">
                  {formatCurrency(holding.avgCostBase)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs md:text-sm hidden sm:table-cell whitespace-nowrap">
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
