import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WatchlistItem } from '@/hooks/useWatchlist';
import { formatCurrency } from '@/lib/calculations';
import { StockNews } from './StockNews';
import { SymbolSummary } from './SymbolSummary';
import { useMarketData } from '@/hooks/useMarketData';

interface StockDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WatchlistItem | null;
}

export function StockDetail({ open, onOpenChange, item }: StockDetailProps) {
  const ticker = item?.symbol.ticker ?? '';
  const { data: liveQuote } = useMarketData(ticker);

  if (!item) return null;

  const highValue = liveQuote?.high ?? item.price?.high_24h;
  const lowValue = liveQuote?.low ?? item.price?.low_24h;

  const highDisplay = typeof highValue === 'number'
    ? formatCurrency(highValue, item.symbol.quote_currency)
    : 'Not available';

  const lowDisplay = typeof lowValue === 'number'
    ? formatCurrency(lowValue, item.symbol.quote_currency)
    : 'Not available';

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

          {/* Key Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base lg:text-lg">Key Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div className="flex justify-between p-2.5 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs md:text-sm text-foreground">Asset Type</span>
                  <span className="font-semibold text-xs md:text-sm">{item.symbol.asset_type}</span>
                </div>
                <div className="flex justify-between p-2.5 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs md:text-sm text-foreground">Quote Currency</span>
                  <span className="font-semibold text-xs md:text-sm">{item.symbol.quote_currency}</span>
                </div>
                <div className="flex justify-between p-2.5 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs md:text-sm text-foreground">24h High</span>
                  <span className="font-semibold text-xs md:text-sm text-success">
                    {highDisplay}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs md:text-sm text-foreground">24h Low</span>
                  <span className="font-semibold text-xs md:text-sm text-destructive">
                    {lowDisplay}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

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
