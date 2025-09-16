import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SymbolSearch } from '@/components/ui/symbol-search';
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SymbolSummary } from '@/components/watchlist/SymbolSummary';

export default function Watchlist() {
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const { data: watchlist, isLoading } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const handleAddSymbol = async (ticker: string, _name: string, _assetType: string) => {
    try {
      await addToWatchlist.mutateAsync(ticker);
      setPendingSelection(ticker.toUpperCase());
    } catch (error) {
      // Errors are handled by the hook toast notifications
    }
  };

  const handleRemoveSymbol = async (symbolId: string) => {
    await removeFromWatchlist.mutateAsync(symbolId);
    if (selectedSymbolId) {
      const selectedItem = watchlist?.find((item) => item.id === selectedSymbolId);
      if (selectedItem && selectedItem.symbol_id === symbolId) {
        setSelectedSymbolId(null);
      }
    }
  };

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

  useEffect(() => {
    if (!watchlist || watchlist.length === 0) {
      setSelectedSymbolId(null);
      setPendingSelection(null);
      return;
    }

    if (pendingSelection) {
      const match = watchlist.find((item) => item.symbol.ticker === pendingSelection);
      if (match) {
        setSelectedSymbolId(match.id);
        setPendingSelection(null);
        return;
      }
    }

    if (selectedSymbolId) {
      const stillExists = watchlist.some((item) => item.id === selectedSymbolId);
      if (!stillExists) {
        setSelectedSymbolId(watchlist[0]?.id ?? null);
      }
    } else {
      setSelectedSymbolId(watchlist[0]?.id ?? null);
    }
  }, [watchlist, selectedSymbolId, pendingSelection]);

  const selectedSymbol = watchlist?.find((item) => item.id === selectedSymbolId) ?? null;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Watchlist</h1>
        <p className="text-muted-foreground">
          Track the symbols you care about and explore real-time summaries without leaving the page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add symbol to watchlist</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search by ticker or company name to keep it handy in your watchlist.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <SymbolSearch
                onSelect={handleAddSymbol}
                placeholder="Search for stocks, ETFs, crypto..."
              />
            </div>
            <p className="text-xs text-muted-foreground md:w-48">
              Choose a result to add it instantly.
            </p>
          </div>
        </CardContent>
      </Card>

      {watchlist?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-2 text-muted-foreground">Your watchlist is empty.</p>
            <p className="text-sm text-muted-foreground">
              Use the search above to add companies, ETFs, or crypto assets you want to follow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            {watchlist?.map((item: WatchlistItem) => {
              const isSelected = item.id === selectedSymbolId;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    'transition-shadow',
                    isSelected ? 'border-primary shadow-lg' : 'hover:shadow-md'
                  )}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedSymbolId(item.id)}
                        className="group flex flex-1 flex-col items-start gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              'font-semibold text-lg transition-colors',
                              isSelected ? 'text-primary' : 'group-hover:text-primary'
                            )}
                          >
                            {item.symbol.ticker}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {item.symbol.asset_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.symbol.name}</p>
                      </button>

                      <div className="flex items-center gap-3 sm:gap-4">
                        {item.price && (
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {formatPrice(item.price.price)}
                            </div>
                            <div
                              className={cn(
                                'flex items-center gap-1 text-sm',
                                (item.price.change_24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {(item.price.change_24h || 0) >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              <span>{formatChange(item.price.change_24h || 0)}</span>
                              <span>({formatChange(item.price.change_percent_24h || 0, true)})</span>
                            </div>
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          asChild
                        >
                          <Link
                            to={`/symbol/${item.symbol.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${item.symbol.ticker} details in a new tab`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSymbol(item.symbol_id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            {selectedSymbol ? (
              <SymbolSummary item={selectedSymbol} />
            ) : (
              <Card className="h-full">
                <CardContent className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  Select a symbol to view its detailed summary.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
