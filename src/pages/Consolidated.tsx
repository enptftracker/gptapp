import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useConsolidatedHoldings } from '@/hooks/useHoldings';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import HoldingsTable from '@/components/dashboard/HoldingsTable';
import MetricCard from '@/components/dashboard/MetricCard';

export default function Consolidated() {
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const { data: consolidatedHoldings = [], isLoading: holdingsLoading } = useConsolidatedHoldings();

  const isLoading = portfoliosLoading || holdingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Consolidated View</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Consolidated View</h1>
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Create portfolios to see consolidated holdings</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate consolidated metrics
  const totalMarketValue = consolidatedHoldings.reduce((sum, holding) => sum + holding.totalMarketValue, 0);
  const totalCost = consolidatedHoldings.reduce((sum, holding) => sum + (holding.totalQuantity * holding.blendedAvgCost), 0);
  const totalPL = totalMarketValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Consolidated View</h1>
        <p className="text-muted-foreground">
          Combined holdings across all portfolios with blended average costs
        </p>
      </div>

      {consolidatedHoldings.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Market Value"
              value={totalMarketValue}
              isCurrency={true}
            />
            <MetricCard
              title="Total Cost Basis"
              value={totalCost}
              isCurrency={true}
            />
            <MetricCard
              title="Total P&L"
              value={totalPL}
              change={totalPL}
              isCurrency={true}
            />
            <MetricCard
              title="Total Return"
              value={totalPLPercent}
              changePercent={totalPLPercent}
              isPercentage={true}
              isCurrency={false}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consolidated Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={consolidatedHoldings.map(ch => ({
                portfolioId: 'consolidated',
                symbolId: ch.symbolId,
                symbol: ch.symbol,
                quantity: ch.totalQuantity,
                avgCostBase: ch.blendedAvgCost,
                marketValueBase: ch.totalMarketValue,
                unrealizedPL: ch.totalUnrealizedPL,
                unrealizedPLPercent: ch.totalUnrealizedPLPercent,
                allocationPercent: ch.allocationPercent,
                currentPrice: ch.currentPrice
              }))} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No holdings to consolidate</h3>
            <p className="text-muted-foreground">
              Add transactions to your portfolios to see consolidated holdings
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}