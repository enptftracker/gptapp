import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdatePrices, UpdatePricesStatus } from "@/hooks/useMarketData";
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
  const [showDialog, setShowDialog] = useState(false);
  const lastStatus = useRef<UpdatePricesStatus>("idle");

  const isRunning = updatePrices.status === "running" || updatePrices.isPending;

  useEffect(() => {
    const status = updatePrices.status;
    if (
      (status === "success" || status === "error") &&
      lastStatus.current === "running"
    ) {
      setShowDialog(true);
    }
    lastStatus.current = status;
  }, [updatePrices.status]);

  const handleRefreshAll = async () => {
    try {
      await updatePrices.mutateAsync();
    } catch (error) {
      console.error("Failed to refresh prices:", error);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      updatePrices.reset();
    }
  };

  const summary = updatePrices.summary;
  const errors = summary?.errors ?? [];
  const hasErrors = errors.length > 0;
  const dialogTitle = updatePrices.status === "error" ? "Price update failed" : "Price update complete";
  const dialogDescription = updatePrices.status === "error"
    ? updatePrices.errorMessage ?? "An unexpected error occurred while updating prices."
    : summary
      ? `Updated ${summary.updated} of ${summary.totalSymbols} tracked tickers.`
      : "Price updates have finished.";

  return (
    <>
      <Button
        onClick={handleRefreshAll}
        disabled={isRunning}
        size="lg"
        className="w-full justify-center gap-2 sm:w-auto sm:justify-start sm:px-6"
        aria-busy={isRunning}
      >
        <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
        <span className="font-semibold">Refresh Prices</span>
      </Button>

      <AlertDialog open={showDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent className="w-[min(calc(100vw-2rem),34rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 text-left">
                <p>{dialogDescription}</p>
                {updatePrices.status !== "error" && summary && (
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span className="text-foreground">Provider</span>
                      <span className="uppercase">{summary.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">Updated</span>
                      <span>{summary.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground">Failed</span>
                      <span>{hasErrors ? errors.length : 0}</span>
                    </div>
                  </div>
                )}
                {updatePrices.status !== "error" && hasErrors && (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Symbols with issues</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {errors.map((error, index) => (
                        <li key={`${error.ticker}-${index}`}>
                          <span className="font-medium text-foreground">{error.ticker}</span>
                          {error.message ? ` — ${error.message}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
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
