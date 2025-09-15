import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SymbolSearch } from "@/components/ui/symbol-search";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, WatchlistItem } from "@/hooks/useWatchlist";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

export default function Watchlist() {
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const { data: watchlist, isLoading } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const handleAddSymbol = async (ticker: string, name: string, assetType: string) => {
    try {
      await addToWatchlist.mutateAsync(ticker);
      setShowAddSymbol(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleRemoveSymbol = async (symbolId: string) => {
    await removeFromWatchlist.mutateAsync(symbolId);
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Watchlist</h1>
        <Button 
          onClick={() => setShowAddSymbol(!showAddSymbol)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Symbol
        </Button>
      </div>

      {showAddSymbol && (
        <Card>
          <CardHeader>
            <CardTitle>Add Symbol to Watchlist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <SymbolSearch
                  onSelect={handleAddSymbol}
                  placeholder="Search for stocks, ETFs, crypto..."
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowAddSymbol(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {watchlist?.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">Your watchlist is empty</p>
            <Button onClick={() => setShowAddSymbol(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first symbol
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {watchlist?.map((item: WatchlistItem) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Link
                      to={`/symbol/${item.symbol.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {item.symbol.ticker}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {item.symbol.asset_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground group-hover:text-primary/80">
                        {item.symbol.name}
                      </p>
                    </Link>
                  </div>

                  <div className="flex items-center gap-6">
                    {item.price && (
                      <div className="text-right">
                        <div className="font-semibold text-lg">
                          {formatPrice(item.price.price)}
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${
                          (item.price.change_24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
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
          ))}
        </div>
      )}
    </div>
  );
}