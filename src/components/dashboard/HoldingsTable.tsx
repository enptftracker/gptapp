import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { Holding } from '@/lib/types';

interface HoldingsTableProps {
  holdings: Holding[];
  className?: string;
}

export default function HoldingsTable({ holdings, className }: HoldingsTableProps) {
  const { baseCurrency } = useCurrencyFormatter();

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No holdings to display</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Avg Cost</TableHead>
            <TableHead className="text-right">Current Price</TableHead>
            <TableHead className="text-right">Market Value</TableHead>
            <TableHead className="text-right">P/L</TableHead>
            <TableHead className="text-right">Allocation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((holding) => {
            const isProfit = holding.unrealizedPL >= 0;
            
            return (
              <TableRow key={`${holding.portfolioId}-${holding.symbolId}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{holding.symbol.ticker}</span>
                    <Badge 
                      variant="outline" 
                      className="w-fit text-xs"
                    >
                      {holding.symbol.assetType}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {holding.quantity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(holding.avgCostBase, baseCurrency)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(holding.currentPrice, holding.symbol.quoteCurrency)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatCurrency(holding.marketValueBase, baseCurrency)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={cn(
                    "flex flex-col text-sm font-medium",
                    isProfit ? "text-profit" : "text-loss"
                  )}>
                    <span className="font-mono">
                      {formatCurrency(holding.unrealizedPL, baseCurrency)}
                    </span>
                    <span className="text-xs">
                      ({formatPercent(holding.unrealizedPLPercent)})
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {formatPercent(holding.allocationPercent)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}