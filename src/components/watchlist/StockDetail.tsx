import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { WatchlistItem } from '@/hooks/useWatchlist';
import { StockChart } from './StockChart';
import { StockNews } from './StockNews';
import { SymbolSummary } from './SymbolSummary';

interface StockDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WatchlistItem | null;
}

export function StockDetail({ open, onOpenChange, item }: StockDetailProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <DialogTitle className="text-xl md:text-2xl lg:text-3xl">
                {item.symbol.name || item.symbol.ticker}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs w-fit">
                  {item.symbol.ticker}
                </Badge>
                <Badge variant="outline" className="text-xs w-fit">
                  {item.symbol.asset_type}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          <SymbolSummary item={item} />

          {/* Latest News */}
          <StockNews ticker={item.symbol.ticker} />

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <p>
              <strong>Disclaimer:</strong> The information provided is for informational purposes
              only and should not be considered financial advice. Market data may be delayed.
              Always conduct your own research before making investment decisions.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
