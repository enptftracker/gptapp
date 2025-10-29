import { useQuery } from '@tanstack/react-query';
import { transactionService, Transaction as DbTransaction, profileService } from '@/lib/supabase';
import { PortfolioCalculations, PortfolioHistoryPoint, LotMethod, QuoteSnapshot } from '@/lib/calculations';
import { MarketDataService } from '@/lib/marketData';

async function fetchQuotesForTransactions(transactions: DbTransaction[]): Promise<QuoteSnapshot[]> {
  const symbolTickerMap = new Map<string, {
    ticker: string;
    assetType?: string;
    quoteCurrency?: string;
  }>();

  for (const transaction of transactions) {
    const symbolId = transaction.symbol_id;
    const ticker = transaction.symbol?.ticker;
    const assetType = transaction.symbol?.asset_type;
    const quoteCurrency = transaction.symbol?.quote_currency;

    if (symbolId && ticker && !symbolTickerMap.has(symbolId)) {
      symbolTickerMap.set(symbolId, {
        ticker,
        assetType,
        quoteCurrency,
      });
    }
  }

  const entries = await Promise.all(
    Array.from(symbolTickerMap.entries()).map(async ([symbolId, metadata]) => {
      try {
        const quote = await MarketDataService.getMarketData(metadata.ticker, {
          assetType: metadata.assetType,
          quoteCurrency: metadata.quoteCurrency,
        });
        if (quote && typeof quote.price === 'number') {
          return {
            symbol_id: symbolId,
            price: quote.price,
            asof: quote.lastUpdated ?? null,
          } satisfies QuoteSnapshot;
        }
      } catch (error) {
        console.error('Failed to fetch live quote for history calculation', ticker, error);
      }

      return null;
    })
  );

  return entries.filter((entry): entry is QuoteSnapshot => entry !== null);
}

async function buildHistoryForTransactions(transactions: DbTransaction[]) {
  if (!transactions || transactions.length === 0) {
    return [] as PortfolioHistoryPoint[];
  }

  const [profile, prices] = await Promise.all([
    profileService.get(),
    fetchQuotesForTransactions(transactions),
  ]);

  const lotMethod = profile?.default_lot_method;
  const isLotMethod = (value: unknown): value is LotMethod =>
    value === 'FIFO' || value === 'LIFO' || value === 'HIFO' || value === 'AVERAGE';
  const normalizedLotMethod: LotMethod = isLotMethod(lotMethod) ? lotMethod : 'FIFO';

  return PortfolioCalculations.calculatePortfolioHistory(transactions, prices, normalizedLotMethod);
}

export function useAllPortfoliosHistory() {
  return useQuery({
    queryKey: ['portfolio-history', 'all'],
    queryFn: async () => {
      const transactions = await transactionService.getAll();
      return buildHistoryForTransactions(transactions);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

export function usePortfolioHistory(portfolioId: string) {
  return useQuery({
    queryKey: ['portfolio-history', portfolioId],
    queryFn: async () => {
      const transactions = await transactionService.getByPortfolio(portfolioId);
      return buildHistoryForTransactions(transactions);
    },
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });
}

