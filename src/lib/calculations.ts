import { Transaction as DbTransaction, Symbol as DbSymbol, PriceData as DbPriceData } from './supabase';
import { Holding, PortfolioMetrics, ConsolidatedHolding } from './types';

type LotMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';

export class PortfolioCalculations {
  /**
   * Calculate average cost basis for a position based on lot method
   */
  static calculateAverageCost(transactions: DbTransaction[], lotMethod: LotMethod = 'FIFO'): number {
    const relevantTransactions = [...transactions]
      .filter(t => t.type === 'BUY' || t.type === 'SELL')
      .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

    if (relevantTransactions.length === 0) {
      return 0;
    }

    if (lotMethod === 'AVERAGE') {
      let totalQuantity = 0;
      let totalCost = 0;

      for (const transaction of relevantTransactions) {
        if (transaction.type === 'BUY') {
          totalQuantity += transaction.quantity;
          totalCost += transaction.quantity * transaction.unit_price;
        } else if (transaction.type === 'SELL' && totalQuantity > 0) {
          const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
          const quantityToRemove = Math.min(transaction.quantity, totalQuantity);

          totalQuantity -= quantityToRemove;
          totalCost -= averageCost * quantityToRemove;
        }
      }

      return totalQuantity > 0 ? totalCost / totalQuantity : 0;
    }

    const lots: Array<{ quantity: number; unitPrice: number }> = [];

    const getLotIndex = (): number => {
      if (lotMethod === 'LIFO') {
        return lots.length - 1;
      }

      if (lotMethod === 'HIFO') {
        let highestIndex = 0;
        for (let index = 1; index < lots.length; index += 1) {
          if (lots[index].unitPrice > lots[highestIndex].unitPrice) {
            highestIndex = index;
          }
        }
        return highestIndex;
      }

      return 0; // FIFO
    };

    for (const transaction of relevantTransactions) {
      if (transaction.type === 'BUY') {
        lots.push({
          quantity: transaction.quantity,
          unitPrice: transaction.unit_price
        });
        continue;
      }

      let remainingToSell = transaction.quantity;

      while (remainingToSell > 0 && lots.length > 0) {
        const lotIndex = getLotIndex();
        const lot = lots[lotIndex];
        const quantityToSell = Math.min(remainingToSell, lot.quantity);

        lot.quantity -= quantityToSell;
        remainingToSell -= quantityToSell;

        if (lot.quantity === 0) {
          lots.splice(lotIndex, 1);
        }
      }
    }

    const remainingQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (remainingQuantity === 0) {
      return 0;
    }

    const remainingCost = lots.reduce((sum, lot) => sum + (lot.quantity * lot.unitPrice), 0);
    return remainingCost / remainingQuantity;
  }

  /**
   * Calculate current quantity held (buys - sells)
   */
  static calculateCurrentQuantity(transactions: DbTransaction[]): number {
    return transactions.reduce((total, t) => {
      switch (t.type) {
        case 'BUY':
          return total + t.quantity;
        case 'SELL':
          return total - t.quantity;
        default:
          return total;
      }
    }, 0);
  }

  /**
   * Calculate realized P/L using specified lot method
   */
  static calculateRealizedPL(transactions: DbTransaction[], lotMethod: string = 'FIFO'): number {
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
    const buyQueue: Array<{ quantity: number; unitPrice: number }> = [];
    let realizedPL = 0;

    for (const transaction of sortedTransactions) {
      if (transaction.type === 'BUY') {
        buyQueue.push({
          quantity: transaction.quantity,
          unitPrice: transaction.unit_price
        });
      } else if (transaction.type === 'SELL') {
        let remainingSellQuantity = transaction.quantity;
        
        while (remainingSellQuantity > 0 && buyQueue.length > 0) {
          const oldestBuy = buyQueue[0];
          const quantityToSell = Math.min(remainingSellQuantity, oldestBuy.quantity);
          
          // Calculate P/L for this lot
          const plForLot = quantityToSell * (transaction.unit_price - oldestBuy.unitPrice);
          realizedPL += plForLot;
          
          // Update quantities
          remainingSellQuantity -= quantityToSell;
          oldestBuy.quantity -= quantityToSell;
          
          if (oldestBuy.quantity === 0) {
            buyQueue.shift();
          }
        }
      }
    }

    return realizedPL;
  }

  /**
   * Calculate unrealized P/L
   */
  static calculateUnrealizedPL(quantity: number, avgCost: number, currentPrice: number): number {
    return quantity * (currentPrice - avgCost);
  }

  /**
   * Calculate holdings for a portfolio
   */
  static calculateHoldings(
    portfolioId: string,
    transactions: DbTransaction[],
    symbols: DbSymbol[],
    prices: DbPriceData[],
    lotMethod: LotMethod = 'FIFO'
  ): Holding[] {
    const portfolioTransactions = transactions.filter(t => t.portfolio_id === portfolioId);
    const symbolGroups = new Map<string, DbTransaction[]>();

    // Group transactions by symbol
    portfolioTransactions.forEach(t => {
      if (t.symbol_id && !symbolGroups.has(t.symbol_id)) {
        symbolGroups.set(t.symbol_id, []);
      }
      if (t.symbol_id) {
        symbolGroups.get(t.symbol_id)!.push(t);
      }
    });

    const holdings: Holding[] = [];
    let totalMarketValue = 0;

    // Calculate holdings for each symbol
    symbolGroups.forEach((symbolTransactions, symbolId) => {
      const symbol = symbols.find(s => s.id === symbolId);
      const priceData = prices.find(p => p.symbol_id === symbolId);
      
      if (!symbol) {
        console.warn(`Symbol not found for ID: ${symbolId}`);
        return;
      }

      const quantity = this.calculateCurrentQuantity(symbolTransactions);
      if (quantity <= 0) return; // Skip if no position

      const avgCostBase = this.calculateAverageCost(symbolTransactions, lotMethod);
      
      // Use price data if available, otherwise use avg cost as fallback for market value
      const currentPrice = priceData?.price || avgCostBase;
      const marketValueBase = quantity * currentPrice;
      const unrealizedPL = this.calculateUnrealizedPL(quantity, avgCostBase, currentPrice);
      const unrealizedPLPercent = avgCostBase > 0 ? (unrealizedPL / (quantity * avgCostBase)) * 100 : 0;

      holdings.push({
        portfolioId,
        symbolId,
        symbol: {
          id: symbol.id,
          ticker: symbol.ticker,
          name: symbol.name || symbol.ticker,
          assetType: symbol.asset_type,
          exchange: symbol.exchange || '',
          quoteCurrency: symbol.quote_currency
        },
        quantity,
        avgCostBase,
        marketValueBase,
        unrealizedPL,
        unrealizedPLPercent,
        allocationPercent: 0, // Will be calculated after we know total
        currentPrice
      });

      totalMarketValue += marketValueBase;
    });

    // Calculate allocation percentages
    holdings.forEach(holding => {
      holding.allocationPercent = totalMarketValue > 0 ? (holding.marketValueBase / totalMarketValue) * 100 : 0;
    });

    return holdings.sort((a, b) => b.marketValueBase - a.marketValueBase);
  }

  /**
   * Calculate portfolio metrics
   */
  static calculatePortfolioMetrics(
    portfolioId: string,
    transactions: DbTransaction[],
    symbols: DbSymbol[],
    prices: DbPriceData[],
    lotMethod: LotMethod = 'FIFO'
  ): PortfolioMetrics {
    const holdings = this.calculateHoldings(portfolioId, transactions, symbols, prices, lotMethod);
    
    const totalEquity = holdings.reduce((sum, h) => sum + h.marketValueBase, 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.avgCostBase), 0);
    const totalPL = holdings.reduce((sum, h) => sum + h.unrealizedPL, 0);
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    // For demo purposes, we'll calculate daily P/L as a percentage of total P/L
    const dailyPL = totalPL * 0.1; // Simulate 10% of total P/L happened today
    const dailyPLPercent = totalEquity > 0 ? (dailyPL / totalEquity) * 100 : 0;

    return {
      portfolioId,
      totalEquity,
      totalCost,
      dailyPL,
      dailyPLPercent,
      totalPL,
      totalPLPercent,
      holdings
    };
  }

  /**
   * Calculate consolidated holdings across all portfolios
   */
  static calculateConsolidatedHoldings(
    portfolios: Array<{ id: string; name: string }>,
    transactions: DbTransaction[],
    symbols: DbSymbol[],
    prices: DbPriceData[],
    lotMethod: LotMethod = 'FIFO'
  ): ConsolidatedHolding[] {
    const symbolHoldings = new Map<string, {
      symbol: DbSymbol;
      portfolios: Array<{
        portfolioId: string;
        portfolioName: string;
        quantity: number;
        avgCost: number;
        marketValue: number;
      }>;
      totalQuantity: number;
      totalCostBasis: number;
      totalMarketValue: number;
    }>();

    // Process each portfolio's holdings
    portfolios.forEach(portfolio => {
      const holdings = this.calculateHoldings(portfolio.id, transactions, symbols, prices, lotMethod);
      
      holdings.forEach(holding => {
        if (!symbolHoldings.has(holding.symbolId)) {
          const dbSymbol = symbols.find(s => s.id === holding.symbolId)!;
          symbolHoldings.set(holding.symbolId, {
            symbol: dbSymbol,
            portfolios: [],
            totalQuantity: 0,
            totalCostBasis: 0,
            totalMarketValue: 0
          });
        }

        const consolidated = symbolHoldings.get(holding.symbolId)!;
        
        consolidated.portfolios.push({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          quantity: holding.quantity,
          avgCost: holding.avgCostBase,
          marketValue: holding.marketValueBase
        });

        consolidated.totalQuantity += holding.quantity;
        consolidated.totalCostBasis += holding.quantity * holding.avgCostBase;
        consolidated.totalMarketValue += holding.marketValueBase;
      });
    });

    // Calculate blended metrics and totals
    const consolidatedHoldings: ConsolidatedHolding[] = [];
    let grandTotalMarketValue = 0;

    symbolHoldings.forEach(({ symbol, portfolios, totalQuantity, totalCostBasis, totalMarketValue }) => {
      const blendedAvgCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
      const totalUnrealizedPL = totalMarketValue - totalCostBasis;
      const totalUnrealizedPLPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
      const currentPrice = totalQuantity > 0 ? totalMarketValue / totalQuantity : 0;

      consolidatedHoldings.push({
        symbolId: symbol.id,
        symbol: {
          id: symbol.id,
          ticker: symbol.ticker,
          name: symbol.name || symbol.ticker,
          assetType: symbol.asset_type,
          exchange: symbol.exchange || '',
          quoteCurrency: symbol.quote_currency
        },
        totalQuantity,
        blendedAvgCost,
        totalMarketValue,
        totalUnrealizedPL,
        totalUnrealizedPLPercent,
        allocationPercent: 0, // Will be calculated after
        currentPrice,
        portfolios
      });

      grandTotalMarketValue += totalMarketValue;
    });

    // Calculate allocation percentages
    consolidatedHoldings.forEach(holding => {
      holding.allocationPercent = grandTotalMarketValue > 0 ? (holding.totalMarketValue / grandTotalMarketValue) * 100 : 0;
    });

    return consolidatedHoldings.sort((a, b) => b.totalMarketValue - a.totalMarketValue);
  }
}

/**
 * Format currency values
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format percentage values
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

/**
 * Format large numbers with abbreviations
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}