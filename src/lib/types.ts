export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Symbol {
  id: string;
  ticker: string;
  name: string;
  assetType: 'EQUITY' | 'ETF' | 'CRYPTO' | 'FUND';
  exchange?: string;
  quoteCurrency: string;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  symbolId: string;
  type: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'DIVIDEND' | 'FEE';
  quantity: number;
  unitPrice: number;
  fee: number;
  fxRate: number;
  tradeCurrency: string;
  tradeDate: Date;
  notes?: string;
}

export interface PriceData {
  symbolId: string;
  price: number;
  priceCurrency: string;
  change24h: number;
  changePercent24h: number;
  asof: Date;
}

export interface Holding {
  portfolioId: string;
  symbolId: string;
  symbol: Symbol;
  quantity: number;
  avgCostBase: number;
  marketValueBase: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  allocationPercent: number;
  currentPrice: number;
}

export interface PortfolioMetrics {
  portfolioId: string;
  totalEquity: number;
  totalCost: number;
  dailyPL: number;
  dailyPLPercent: number;
  totalPL: number;
  totalPLPercent: number;
  holdings: Holding[];
}

export interface ConsolidatedHolding {
  symbolId: string;
  symbol: Symbol;
  totalQuantity: number;
  blendedAvgCost: number;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalUnrealizedPLPercent: number;
  allocationPercent: number;
  currentPrice: number;
  portfolios: {
    portfolioId: string;
    portfolioName: string;
    quantity: number;
    avgCost: number;
    marketValue: number;
  }[];
}

export interface UserSettings {
  baseCurrency: string;
  timezone: string;
  lotMethod: 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';
}