import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdatePrices, UpdatePricesStatus } from "@/hooks/useMarketData";
import { MarketDataService } from "@/lib/marketData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PriceRefreshButton() {
  const updatePrices = useUpdatePrices();
  const { toast } = useToast();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const lastStatus = useRef<UpdatePricesStatus>("idle");

  const isInProgress = updatePrices.status === "in-progress" || updatePrices.isPending;

  useEffect(() => {
    const status = updatePrices.status;
    if (
      (status === "completed" || status === "failed") &&
      lastStatus.current === "in-progress"
    ) {
      setShowCompletionDialog(true);
    }
    lastStatus.current = status;
  }, [updatePrices.status]);

  const progressValue = useMemo(() => {
    if (!updatePrices.progress) {
      return 0;
    }
    if (updatePrices.progress.totalBatches === 0) {
      return updatePrices.status === "completed" ? 100 : 0;
    }
    const percentage = (updatePrices.progress.currentBatch / updatePrices.progress.totalBatches) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [updatePrices.progress, updatePrices.status]);

  const statusText = useMemo(() => {
    const progress = updatePrices.progress;
    if (!progress) {
      return null;
    }
    if (progress.totalBatches === 0) {
      return "Preparing price update...";
    }
    const current = Math.min(progress.currentBatch, progress.totalBatches);
    return `Batch ${current} of ${progress.totalBatches}`;
  }, [updatePrices.progress]);

  const successErrorText = useMemo(() => {
    const progress = updatePrices.progress;
    if (!progress) {
      return null;
    }
    return `Success: ${progress.successCount} • Errors: ${progress.errorCount}`;
  }, [updatePrices.progress]);

  const handleRefreshAll = async () => {
    try {
      await updatePrices.mutateAsync();
    } catch (error) {
      // Errors are handled through hook state.
      console.error("Failed to refresh prices:", error);
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

  const handleDialogChange = (open: boolean) => {
    setShowCompletionDialog(open);
    if (!open) {
      updatePrices.reset();
    }
  };

  const summary = updatePrices.summary;
  const hasErrors = (summary?.errorCount ?? 0) > 0;
  const dialogTitle = updatePrices.status === "failed" ? "Price update failed" : "Price update completed";
  const dialogDescription = updatePrices.status === "failed"
    ? updatePrices.errorMessage ?? "An unexpected error occurred while updating prices."
    : summary
      ? `Processed ${summary.successCount} of ${summary.totalSymbols} tickers.`
      : "Price updates have finished.";

  return (
    <>
      <div className="flex flex-col gap-4 w-full">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleRefreshAll}
            disabled={isInProgress}
            size="lg"
            className="w-full justify-center gap-2 sm:w-auto sm:justify-start sm:px-6"
            aria-busy={isInProgress}
          >
            <RefreshCw className={`h-4 w-4 ${isInProgress ? 'animate-spin' : ''}`} />
            <span className="font-semibold">Refresh Prices</span>
          </Button>

          <Button
            onClick={handleFetchHistorical}
            size="lg"
            variant="outline"
            className="w-full justify-center gap-2 sm:w-auto sm:justify-start sm:px-6"
          >
            Fetch Historical Data
          </Button>
        </div>

        {isInProgress && (
          <div className="w-full max-w-xl space-y-3 rounded-lg border border-border/60 bg-card/80 p-4 shadow-sm">
            {statusText && (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-foreground">Updating market prices…</span>
                <span>{statusText}</span>
              </div>
            )}
            <Progress value={progressValue} className="h-2" />
            {successErrorText && (
              <div className="text-xs text-muted-foreground">{successErrorText}</div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={showCompletionDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent className="w-[min(calc(100vw-2rem),34rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 text-left">
                <p>{dialogDescription}</p>
                {updatePrices.status !== "failed" && hasErrors && summary && (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Tickers with issues:</p>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
                      {summary.errors.map((error, index) => (
                        <li key={`${error.ticker}-${index}`}>
                          <span className="font-medium text-foreground">{error.ticker}</span>
                          {error.message ? ` — ${error.message}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {updatePrices.status !== "failed" && summary && !hasErrors && (
                  <p className="text-muted-foreground">All tickers updated successfully.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogAction
              onClick={() => handleDialogChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
