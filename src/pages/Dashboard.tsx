import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MetricCard from '@/components/dashboard/MetricCard';
import HoldingsTable from '@/components/dashboard/HoldingsTable';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useTransactions } from '@/hooks/useTransactions';
import { useConsolidatedHoldings } from '@/hooks/useHoldings';
import { useUpdatePrices } from '@/hooks/useMarketData';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import TransactionForm from '@/components/transactions/TransactionForm';
import AllocationChart from '@/components/dashboard/AllocationChart';

export default function Dashboard() {
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const { isLoading: transactionsLoading } = useTransactions();
  const { data: consolidatedHoldings = [], isLoading: holdingsLoading } = useConsolidatedHoldings();
  const updatePrices = useUpdatePrices();
  const { formatBaseCurrency } = useCurrencyFormatter();

  const isLoading = portfoliosLoading || transactionsLoading || holdingsLoading;

  // Calculate real metrics from holdings
  const totalEquity = consolidatedHoldings.reduce((sum, h) => sum + h.totalMarketValue, 0);
  const totalCost = consolidatedHoldings.reduce((sum, h) => sum + (h.totalQuantity * h.blendedAvgCost), 0);
  const totalPL = consolidatedHoldings.reduce((sum, h) => sum + h.totalUnrealizedPL, 0);
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  
  // Simulate daily change as a percentage of total P/L
  const dailyPL = totalPL * 0.1;
  const dailyPLPercent = totalEquity > 0 ? (dailyPL / totalEquity) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your portfolio performance overview
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your portfolio performance overview
          </p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No portfolios found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first portfolio to start tracking your investments
            </p>
            <Button asChild>
              <Link to="/portfolios">
                <Plus className="mr-2 h-4 w-4" />
                Create Portfolio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your portfolio performance overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={async () => {
              try {
                await updatePrices.mutateAsync();
              } catch (error) {
                console.error('Error updating prices:', error);
              }
            }}
            disabled={updatePrices.isPending}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${updatePrices.isPending ? 'animate-spin' : ''}`} />
            {updatePrices.isPending ? 'Updating...' : 'Refresh Prices'}
          </Button>
          <Button asChild>
            <Link to="/portfolios">
              <Plus className="mr-2 h-4 w-4" />
              Create Portfolio
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Equity"
          value={totalEquity}
          changePercent={dailyPLPercent}
        />
        <MetricCard
          title="Total P/L"
          value={totalPL}
          changePercent={totalPLPercent}
        />
        <MetricCard
          title="Daily Change"
          value={dailyPL}
          changePercent={dailyPLPercent}
        />
        <MetricCard
          title="Holdings"
          value={consolidatedHoldings.length}
          isCurrency={false}
        />
      </div>

      {/* Holdings Overview */}
      {consolidatedHoldings.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Top Holdings</CardTitle>
                <div className="flex items-center space-x-2">
                  <TransactionForm portfolios={portfolios} />
                  <Button variant="outline" asChild>
                    <Link to="/consolidated">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View All
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <HoldingsTable
                holdings={consolidatedHoldings.slice(0, 5).map(h => ({
                  portfolioId: '',
                  symbolId: h.symbolId,
                  symbol: h.symbol,
                  quantity: h.totalQuantity,
                  avgCostBase: h.blendedAvgCost,
                  marketValueBase: h.totalMarketValue,
                  unrealizedPL: h.totalUnrealizedPL,
                  unrealizedPLPercent: h.totalUnrealizedPLPercent,
                  allocationPercent: h.allocationPercent,
                  currentPrice: h.currentPrice
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allocation Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <AllocationChart
                holdings={consolidatedHoldings.map(h => ({
                  portfolioId: '',
                  symbolId: h.symbolId,
                  symbol: h.symbol,
                  quantity: h.totalQuantity,
                  avgCostBase: h.blendedAvgCost,
                  marketValueBase: h.totalMarketValue,
                  unrealizedPL: h.totalUnrealizedPL,
                  unrealizedPLPercent: h.totalUnrealizedPLPercent,
                  allocationPercent: h.allocationPercent,
                  currentPrice: h.currentPrice
                }))}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {portfolios.map(portfolio => (
                <div key={portfolio.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">{portfolio.name}</h3>
                    {portfolio.description && (
                      <p className="text-sm text-muted-foreground">{portfolio.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">{formatBaseCurrency(0)}</p>
                    <p className="text-sm text-muted-foreground">0 holdings</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}