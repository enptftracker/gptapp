import { useMemo, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SymbolSearch } from "@/components/ui/symbol-search";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, WatchlistItem } from "@/hooks/useWatchlist";
import { Skeleton } from "@/components/ui/skeleton";
import { StockDetail } from "@/components/watchlist/StockDetail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, formatDistanceToNow } from "date-fns";

export default function Watchlist() {
  const [selectedStock, setSelectedStock] = useState<WatchlistItem | null>(null);
  const {
    data: watchlist,
    isLoading,
    error,
    dataUpdatedAt,
  } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const handleAddSymbol = async (ticker: string, name: string, assetType: string) => {
    try {
      await addToWatchlist.mutateAsync(ticker);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleRemoveSymbol = async (symbolId: string) => {
    await removeFromWatchlist.mutateAsync(symbolId);
  };

  const lastUpdatedAt = useMemo(() => {
    const latestPriceUpdate = watchlist?.reduce((latest, item) => {
      const priceUpdatedAt = item.price?.lastUpdated ?? 0;
      return priceUpdatedAt > latest ? priceUpdatedAt : latest;
    }, 0) ?? 0;

    if (latestPriceUpdate) {
      return latestPriceUpdate;
    }

    return dataUpdatedAt ?? 0;
  }, [watchlist, dataUpdatedAt]);

  const formattedLastUpdated = lastUpdatedAt
    ? `${format(new Date(lastUpdatedAt), "PPpp")} (${formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })})`
    : null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number, isPercent = false) => {
    const formatted = isPercent 
      ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
      : `${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
    return formatted;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Watchlist</h1>
          <Skeleton className="h-9 w-28 md:h-10 md:w-32" />
        </div>
        <div className="grid gap-3 md:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold">Watchlist</h1>
            {formattedLastUpdated && (
              <p className="text-xs md:text-sm text-muted-foreground">
                Last updated {formattedLastUpdated}
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Add Ticker to Watchlist</CardTitle>
            </CardHeader>
            <CardContent>
              <SymbolSearch
                onSelect={handleAddSymbol}
                placeholder="Search for stocks, ETFs, crypto..."
                className="text-sm md:text-base"
              />
            </CardContent>
          </Card>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to load data</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'An unexpected error occurred while loading your watchlist.'}
            </AlertDescription>
          </Alert>
        )}

        {watchlist?.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 md:py-12">
              <p className="text-sm md:text-base text-muted-foreground">Start by searching for a ticker above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {watchlist?.map((item: WatchlistItem) => (
              <Card 
                key={item.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedStock(item)}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base md:text-lg truncate">
                          {item.symbol.name || item.symbol.ticker}
                        </h3>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {item.symbol.ticker}
                        </Badge>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {item.symbol.asset_type}
                        </Badge>
                      </div>
                      {item.price?.lastUpdated && (
                        <p className="text-[11px] md:text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(item.price.lastUpdated), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-6">
                      {item.price && (
                        <div className="text-right">
                          <div className="font-semibold text-sm md:text-lg">
                            {formatPrice(item.price.price)}
                          </div>
                          <div className={`flex items-center gap-1 text-xs md:text-sm ${
                            (item.price.change_24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {(item.price.change_24h || 0) >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">{formatChange(item.price.change_24h || 0)}</span>
                            <span>({formatChange(item.price.change_percent_24h || 0, true)})</span>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSymbol(item.symbol_id);
                        }}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <StockDetail 
        open={!!selectedStock} 
        onOpenChange={(open) => !open && setSelectedStock(null)}
        item={selectedStock}
      />
    </>
  );
}
