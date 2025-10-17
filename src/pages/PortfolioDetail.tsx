import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { usePortfolios } from '@/hooks/usePortfolios';
import { usePortfolioTransactions } from '@/hooks/useTransactions';
import { usePortfolioHoldings, usePortfolioMetrics } from '@/hooks/useHoldings';
import HoldingsTable from '@/components/dashboard/HoldingsTable';
import TransactionHistory from '@/components/transactions/TransactionHistory';
import TransactionForm from '@/components/transactions/TransactionForm';
import MetricCard from '@/components/dashboard/MetricCard';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { HistoricalValueChart } from '@/components/analytics/HistoricalValueChart';
import { PerformanceBreakdown } from '@/components/analytics/PerformanceBreakdown';
import { AssetTypeBreakdown } from '@/components/analytics/AssetTypeBreakdown';
import PortfolioChart from '@/components/portfolio/PortfolioChart';
import { useProfile } from '@/hooks/useProfile';
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory';

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: portfolios = [] } = usePortfolios();
  const { data: transactions = [], isLoading: transactionsLoading } = usePortfolioTransactions(id!);
  const { data: holdings = [], isLoading: holdingsLoading } = usePortfolioHoldings(id!);
  const { data: metrics, isLoading: metricsLoading } = usePortfolioMetrics(id!);
  const { data: history = [], isLoading: historyLoading } = usePortfolioHistory(id!);
  const { data: profile } = useProfile();

  const portfolio = portfolios.find(p => p.id === id);
  const isLoading = transactionsLoading || holdingsLoading || metricsLoading || historyLoading;

  if (!portfolio) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portfolios">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portfolios
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Portfolio not found</h3>
            <p className="text-muted-foreground">
              The requested portfolio could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portfolios">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portfolios
            </Link>
          </Button>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/portfolios">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portfolios
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
            {portfolio.description && (
              <p className="text-muted-foreground">{portfolio.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TransactionForm
            portfolios={[portfolio]}
            defaultPortfolioId={portfolio.id}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Equity"
          value={metrics?.totalEquity || 0}
          changePercent={metrics?.dailyPLPercent || 0}
        />
        <MetricCard
          title="Total Cost"
          value={metrics?.totalCost || 0}
          isCurrency={true}
        />
        <MetricCard
          title="Total P/L"
          value={metrics?.totalPL || 0}
          changePercent={metrics?.totalPLPercent || 0}
        />
        <MetricCard
          title="Holdings"
          value={holdings.length}
          isCurrency={false}
        />
      </div>

      {/* Performance Card */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>Performance Summary</span>
              {metrics.totalPL >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Market Value</p>
                <p className="text-lg font-mono font-semibold">
                  {formatCurrency(metrics.totalEquity)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cost Basis</p>
                <p className="text-lg font-mono font-medium">
                  {formatCurrency(metrics.totalCost)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Unrealized P/L</p>
                <div className={`text-lg font-mono font-semibold ${
                  metrics.totalPL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <p>{formatCurrency(metrics.totalPL)}</p>
                  <p className="text-sm">({formatPercent(metrics.totalPLPercent)})</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Daily Change</p>
                <div className={`text-lg font-mono font-semibold ${
                  metrics.dailyPL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  <p>{formatCurrency(metrics.dailyPL)}</p>
                  <p className="text-sm">({formatPercent(metrics.dailyPLPercent)})</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Charts */}
      {holdings.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <HistoricalValueChart data={history} title="Portfolio Value Over Time" />
            <PortfolioChart holdings={holdings} title="Portfolio Allocation" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <PerformanceBreakdown holdings={holdings} />
            <AssetTypeBreakdown holdings={holdings} />
          </div>
        </>
      )}

      {/* Holdings and Transactions */}
      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable holdings={holdings} lotMethod={profile?.default_lot_method} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transactions">
          <TransactionHistory 
            transactions={transactions}
            title={`Transactions (${transactions.length})`}
            portfolios={portfolios}
            defaultPortfolioId={id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}