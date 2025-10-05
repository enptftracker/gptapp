import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { WatchlistItem } from '@/hooks/useWatchlist';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { StockChart } from './StockChart';
import { StockNews } from './StockNews';

interface StockDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WatchlistItem | null;
}

export function StockDetail({ open, onOpenChange, item }: StockDetailProps) {
  if (!item) return null;

  const isPositive = (item.price?.change_24h || 0) >= 0;
  const priceValue = item.price?.price || 0;
  const change24h = item.price?.change_24h || 0;
  const changePercent = item.price?.change_percent_24h || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <DialogTitle className="text-xl md:text-2xl lg:text-3xl">{item.symbol.ticker}</DialogTitle>
              <Badge variant="outline" className="text-xs w-fit">
                {item.symbol.asset_type}
              </Badge>
            </div>
            <p className="text-xs md:text-sm lg:text-base text-muted-foreground">{item.symbol.name}</p>
          </div>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          {/* Price Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base lg:text-lg">Current Price</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 md:gap-4">
                <div>
                  <p className="text-2xl md:text-3xl lg:text-4xl font-bold font-mono">
                    {formatCurrency(priceValue, item.symbol.quote_currency)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-success" />
                    ) : (
                      <TrendingDown className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-destructive" />
                    )}
                    <span
                      className={cn(
                        "text-sm md:text-base lg:text-lg font-semibold",
                        isPositive ? "text-success" : "text-destructive"
                      )}
                    >
                      {formatCurrency(Math.abs(change24h), item.symbol.quote_currency)} (
                      {formatPercent(changePercent)})
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground text-xs md:text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                  24h Change
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <StockChart ticker={item.symbol.ticker} currency={item.symbol.quote_currency} />

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
                    {formatCurrency(priceValue * 1.05, item.symbol.quote_currency)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 md:p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs md:text-sm text-foreground">24h Low</span>
                  <span className="font-semibold text-xs md:text-sm text-destructive">
                    {formatCurrency(priceValue * 0.95, item.symbol.quote_currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Market Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm md:text-base lg:text-lg">Market Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-xs md:text-sm lg:text-base text-foreground">
                  {item.symbol.ticker} is currently trading at{' '}
                  {formatCurrency(priceValue, item.symbol.quote_currency)} with a{' '}
                  {isPositive ? 'gain' : 'loss'} of{' '}
                  {formatPercent(Math.abs(changePercent))} over the past 24 hours.
                </p>
                <p className="mt-2 md:mt-3 text-xs md:text-sm lg:text-base text-foreground">
                  This {item.symbol.asset_type.toLowerCase()} is denominated in{' '}
                  {item.symbol.quote_currency}. Real-time market data is provided for
                  informational purposes only.
                </p>
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
