import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdatePrices } from "@/hooks/useMarketData";
import { MarketDataService } from "@/lib/marketData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PriceRefreshButton() {
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const updatePrices = useUpdatePrices();
  const { toast } = useToast();

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    try {
      await updatePrices.mutateAsync();
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleFetchHistorical = async () => {
    try {
      const [watchlistResponse, transactionResponse] = await Promise.all([
        supabase
          .from('watchlist')
          .select('symbol:symbols(ticker)'),
        supabase
          .from('transactions')
          .select('symbol:symbols(ticker)')
          .not('symbol', 'is', null)
      ]);

      if (watchlistResponse.error) throw watchlistResponse.error;
      if (transactionResponse.error) throw transactionResponse.error;

      const symbolSet = new Set<string>();

      (watchlistResponse.data || []).forEach(entry => {
        const ticker = entry?.symbol?.ticker?.toUpperCase();
        if (ticker) symbolSet.add(ticker);
      });

      (transactionResponse.data || []).forEach(entry => {
        const ticker = entry?.symbol?.ticker?.toUpperCase();
        if (ticker) symbolSet.add(ticker);
      });

      const symbols = Array.from(symbolSet);

      await MarketDataService.fetchHistoricalData(symbols);
      toast({
        title: "Historical data requested",
        description: symbols.length
          ? `Fetching up to 10 years of historical data for ${symbols.length} symbols. This may take a few minutes.`
          : "Fetching historical data for default indices. This may take a few minutes.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request historical data fetch",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleRefreshAll}
        disabled={isRefreshingAll || updatePrices.isPending}
        size="sm"
        variant="outline"
        className="flex items-center gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${(isRefreshingAll || updatePrices.isPending) ? 'animate-spin' : ''}`} />
        Refresh Prices
      </Button>
      
      <Button
        onClick={handleFetchHistorical}
        size="sm"
        variant="outline"
      >
        Fetch Historical Data
      </Button>
    </div>
  );
}