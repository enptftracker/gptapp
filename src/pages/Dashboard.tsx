import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MetricCard from '@/components/dashboard/MetricCard';
import HoldingsTable from '@/components/dashboard/HoldingsTable';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useTransactions } from '@/hooks/useTransactions';
import { useConsolidatedHoldings } from '@/hooks/useHoldings';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, RefreshCw, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import TransactionForm from '@/components/transactions/TransactionForm';
import { HistoricalValueChart } from '@/components/analytics/HistoricalValueChart';
import { PerformanceBreakdown } from '@/components/analytics/PerformanceBreakdown';
import { AssetTypeBreakdown } from '@/components/analytics/AssetTypeBreakdown';
import PortfolioChart from '@/components/portfolio/PortfolioChart';
import { useLanguage } from '@/contexts/LanguageContext';
import { MarketDataService } from '@/lib/marketData';
import { priceService } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { ConsolidatedHolding } from '@/lib/types';
import { useProfile } from '@/hooks/useProfile';
import { useAllPortfoliosHistory } from '@/hooks/usePortfolioHistory';

type RefreshResult = { symbol: string; success: boolean; message?: string };

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const {
    data: consolidatedHoldings = [],
    isLoading: holdingsLoading
  } = useConsolidatedHoldings() as {
    data?: ConsolidatedHolding[];
    isLoading: boolean;
  };
  const { data: profile } = useProfile();
  const { data: portfolioHistory = [], isLoading: historyLoading } = useAllPortfoliosHistory();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshTotal, setRefreshTotal] = useState<number | null>(null);
  const [refreshCompleted, setRefreshCompleted] = useState(0);
  const [lastRefreshedTicker, setLastRefreshedTicker] = useState<string | null>(null);

  const getUniqueHoldings = (holdings: ConsolidatedHolding[]) =>
    holdings.reduce<Array<{ symbolId: string; ticker: string }>>((acc, holding) => {
      const symbolId = (holding.symbolId ?? '').trim();
      const ticker = (holding.symbol?.ticker ?? '').trim();

      if (!symbolId || !ticker) {
        return acc;
      }

      if (!acc.some(item => item.symbolId === symbolId)) {
        acc.push({ symbolId, ticker: ticker.toUpperCase() });
      }

      return acc;
    }, []);

  const refreshPricesMutation = useMutation<RefreshResult[], unknown, ConsolidatedHolding[]>({
    mutationFn: async (holdings) => {
      const uniqueHoldings = getUniqueHoldings(holdings);

      setRefreshTotal(uniqueHoldings.length);

      if (uniqueHoldings.length === 0) {
        throw new Error(t('dashboard.pricesUpdateFailed'));
      }

      const results: RefreshResult[] = [];

      for (const holding of uniqueHoldings) {
        try {
          const quote = await MarketDataService.getMarketData(holding.ticker);

          if (!quote || typeof quote.price !== 'number') {
            throw new Error('Quote data unavailable');
          }

          await priceService.updatePrice(holding.symbolId, quote.price, {
            change: quote.change,
            changePercent: quote.changePercent,
            asof: quote.lastUpdated
          });
          results.push({ symbol: holding.ticker, success: true });
        } catch (error) {
          console.error(`Failed to refresh price for ${holding.ticker}:`, error);
          results.push({
            symbol: holding.ticker,
            success: false,
            message: error instanceof Error ? error.message : undefined
          });
        } finally {
          setRefreshCompleted(prev => prev + 1);
          setLastRefreshedTicker(holding.ticker);
        }
      }

      return results;
    },
    onMutate: holdings => {
      const uniqueHoldings = getUniqueHoldings(holdings);
      setRefreshTotal(uniqueHoldings.length);
      setRefreshCompleted(0);
      setLastRefreshedTicker(null);
    },
    onSuccess: async (results) => {
      const successes = results.filter(result => result.success).length;
      const failures = results.length - successes;

      if (successes > 0 && failures === 0) {
        toast({
          title: t('common.success'),
          description: t('dashboard.pricesUpdated')
        });
      } else if (successes > 0) {
        toast({
          title: t('common.success'),
          description: t('dashboard.pricesUpdatePartial')
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('dashboard.pricesUpdateFailed')
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] })
      ]);
    },
    onError: (error: unknown) => {
      console.error('Failed to refresh prices:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error && error.message
            ? error.message
            : t('dashboard.pricesUpdateFailed')
      });
    },
    onSettled: () => {
      setRefreshTotal(null);
      setRefreshCompleted(0);
      setLastRefreshedTicker(null);
    }
  });

  const handleRefreshPrices = () => {
    if (refreshPricesMutation.isPending || consolidatedHoldings.length === 0) {
      return;
    }

    refreshPricesMutation.mutate(consolidatedHoldings);
  };

  const isLoading = portfoliosLoading || transactionsLoading || holdingsLoading || historyLoading;

  // Calculate real metrics from holdings
  const totalPortfolios = portfolios.length;
  const totalTransactions = transactions.length;
  const totalEquity = consolidatedHoldings.reduce((sum, h) => sum + h.totalMarketValue, 0);
  const totalCost = consolidatedHoldings.reduce((sum, h) => sum + (h.totalQuantity * h.blendedAvgCost), 0);
  const totalPL = consolidatedHoldings.reduce((sum, h) => sum + h.totalUnrealizedPL, 0);
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  
  // Simulate daily change as a percentage of total P/L
  const dailyPL = totalPL * 0.1;
  const dailyPLPercent = totalEquity > 0 ? (dailyPL / totalEquity) * 100 : 0;

  const sparklinePoints = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.length === 0) {
      return [] as Array<{ height: number }>;
    }

    const recentPoints = portfolioHistory.slice(-10);
    if (recentPoints.length === 0) {
      return [];
    }

    const values = recentPoints.map(point => point.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    return recentPoints.map(point => {
      if (max === min) {
        return { height: 60 };
      }

      const normalized = (point.value - min) / (max - min);
      return { height: 30 + (normalized * 70) };
    });
  }, [portfolioHistory]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle')}
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
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('dashboard.noPortfolios')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('dashboard.noPortfoliosDesc')}
            </p>
            <Button asChild>
              <Link to="/portfolios">
                <Plus className="mr-2 h-4 w-4" />
                {t('dashboard.createPortfolio')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Modern Header Section */}
      <div className="space-y-6">
        {/* Total Portfolio Value - Large Display */}
        <div className="space-y-2">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            {formatCurrency(totalEquity)}
          </h1>
          <div className={cn(
            "flex items-center gap-2 text-lg font-medium",
            dailyPL >= 0 ? "text-profit" : "text-loss"
          )}>
            <span>{dailyPL >= 0 ? '↗' : '↘'}</span>
            <span>
              {formatCurrency(Math.abs(dailyPL))} ({dailyPLPercent >= 0 ? '+' : ''}{dailyPLPercent.toFixed(2)}%) {t('dashboard.last24h')}
            </span>
          </div>
        </div>

        {/* Modern Metric Cards */}
        <div className="grid gap-3 grid-cols-2">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('dashboard.investments')}</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              <div className="mt-3 h-16">
                <div className="w-full h-full flex items-end gap-1">
                  {sparklinePoints.map((point, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 rounded-t"
                      style={{ height: `${point.height}%` }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{t('dashboard.totalPL')}</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPL)}</p>
              <p className={cn(
                "text-sm mt-1",
                totalPLPercent >= 0 ? "text-profit" : "text-loss"
              )}>
                {totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <Button
            onClick={handleRefreshPrices}
            size="lg"
            className="w-full md:w-auto md:self-stretch"
            disabled={refreshPricesMutation.isPending || consolidatedHoldings.length === 0}
          >
            {refreshPricesMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <div className="flex flex-col items-start">
                  <span>
                    {t('dashboard.updating')} ({refreshCompleted}/{refreshTotal ?? 0})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {refreshTotal ? `${Math.round((refreshCompleted / refreshTotal) * 100)}%` : '0%'}
                    {lastRefreshedTicker ? ` • ${lastRefreshedTicker}` : ''}
                  </span>
                </div>
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('dashboard.refreshPrices')}
              </>
            )}
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full md:w-auto md:self-stretch">
            <Link to="/portfolios">
              <Plus className="mr-2 h-4 w-4" />
              {t('dashboard.newPortfolio')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Holdings Overview */}
      {consolidatedHoldings.length > 0 ? (
        <>
          {/* Analytics Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <HistoricalValueChart data={portfolioHistory} />
            <PortfolioChart
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
              title={t('dashboard.portfolioAllocation')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PerformanceBreakdown
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
            <AssetTypeBreakdown 
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
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-lg md:text-xl">{t('dashboard.topPositions')}</CardTitle>
                <TransactionForm portfolios={portfolios} />
              </div>
            </CardHeader>
            <CardContent>
              <HoldingsTable
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
                lotMethod={profile?.default_lot_method}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.portfolioSummary')}</CardTitle>
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
                    <p className="font-mono font-semibold">{formatCurrency(0)}</p>
                    <p className="text-sm text-muted-foreground">0 {t('dashboard.positions')}</p>
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