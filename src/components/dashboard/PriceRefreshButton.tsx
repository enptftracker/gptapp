import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdatePrices } from "@/hooks/useMarketData";
import { MarketDataService } from "@/lib/marketData";
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
      await MarketDataService.fetchHistoricalData();
      toast({
        title: "Historical data requested",
        description: "Fetching 5 years of historical data for major indices. This may take a few minutes.",
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