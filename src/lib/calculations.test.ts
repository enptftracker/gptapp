import { describe, expect, it } from 'bun:test';

import { PortfolioCalculations } from './calculations';
import type { Transaction as DbTransaction } from './supabase';

const buildTransaction = (overrides: Partial<DbTransaction>): DbTransaction => ({
  id: overrides.id ?? crypto.randomUUID(),
  owner_id: overrides.owner_id ?? 'user-1',
  portfolio_id: overrides.portfolio_id ?? 'portfolio-1',
  symbol_id: overrides.symbol_id,
  type: overrides.type ?? 'BUY',
  quantity: overrides.quantity ?? 0,
  unit_price: overrides.unit_price ?? 0,
  fee: overrides.fee ?? 0,
  fx_rate: overrides.fx_rate ?? 1,
  trade_currency: overrides.trade_currency ?? 'USD',
  trade_date: overrides.trade_date ?? new Date().toISOString(),
  notes: overrides.notes,
  lot_link: overrides.lot_link,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
  symbol: overrides.symbol
});

const sampleTransactions: DbTransaction[] = [
  buildTransaction({ id: '1', type: 'BUY', quantity: 10, unit_price: 100, trade_date: '2024-01-01T00:00:00Z' }),
  buildTransaction({ id: '2', type: 'BUY', quantity: 5, unit_price: 120, trade_date: '2024-02-01T00:00:00Z' }),
  buildTransaction({ id: '3', type: 'SELL', quantity: 8, unit_price: 150, trade_date: '2024-03-01T00:00:00Z' }),
  buildTransaction({ id: '4', type: 'BUY', quantity: 5, unit_price: 90, trade_date: '2024-04-01T00:00:00Z' })
];

describe('PortfolioCalculations.calculateAverageCost', () => {
  it('calculates FIFO cost basis from remaining lots', () => {
    const avgCost = PortfolioCalculations.calculateAverageCost(sampleTransactions, 'FIFO');
    expect(avgCost).toBeCloseTo(104.1666667, 6);
  });

  it('calculates LIFO cost basis from remaining lots', () => {
    const avgCost = PortfolioCalculations.calculateAverageCost(sampleTransactions, 'LIFO');
    expect(avgCost).toBeCloseTo(95.8333333, 6);
  });

  it('calculates HIFO cost basis from remaining lots', () => {
    const avgCost = PortfolioCalculations.calculateAverageCost(sampleTransactions, 'HIFO');
    expect(avgCost).toBeCloseTo(95.8333333, 6);
  });

  it('calculates average cost basis when using average lot method', () => {
    const avgCost = PortfolioCalculations.calculateAverageCost(sampleTransactions, 'AVERAGE');
    expect(avgCost).toBeCloseTo(99.7222222, 6);
  });
});

describe('PortfolioCalculations.calculatePortfolioHistory', () => {
  const mixedPriceTransactions: DbTransaction[] = [
    buildTransaction({
      id: 'fifo-hifo-1',
      type: 'BUY',
      quantity: 1,
      unit_price: 100,
      symbol_id: 'symbol-1',
      trade_date: '2024-01-01T00:00:00Z'
    }),
    buildTransaction({
      id: 'fifo-hifo-2',
      type: 'BUY',
      quantity: 1,
      unit_price: 200,
      symbol_id: 'symbol-1',
      trade_date: '2024-01-02T00:00:00Z'
    }),
    buildTransaction({
      id: 'fifo-hifo-3',
      type: 'SELL',
      quantity: 1,
      unit_price: 150,
      symbol_id: 'symbol-1',
      trade_date: '2024-01-03T00:00:00Z'
    }),
    buildTransaction({
      id: 'fifo-hifo-4',
      type: 'SELL',
      quantity: 1,
      unit_price: 175,
      symbol_id: 'symbol-1',
      trade_date: '2024-01-04T00:00:00Z'
    })
  ];

  const historyOptions = {
    endDate: new Date('2024-01-04T00:00:00Z')
  } as const;

  it('tracks cumulative net investment over time when using FIFO lots', () => {
    const history = PortfolioCalculations.calculatePortfolioHistory(
      mixedPriceTransactions,
      [],
      'FIFO',
      historyOptions
    );

    expect(history.map(point => point.cost)).toEqual([100, 300, 150, -25]);
  });

  it('tracks the same cumulative investment regardless of lot method', () => {
    const history = PortfolioCalculations.calculatePortfolioHistory(
      mixedPriceTransactions,
      [],
      'HIFO',
      historyOptions
    );

    expect(history.map(point => point.cost)).toEqual([100, 300, 150, -25]);
  });

  it('uses trade prices before quotes become effective and aligns latest point with consolidated holdings', () => {
    const transactions: DbTransaction[] = [
      buildTransaction({
        id: 'trade-1',
        type: 'BUY',
        quantity: 2,
        unit_price: 50,
        symbol_id: 'symbol-quote',
        trade_date: '2024-01-01T00:00:00Z'
      })
    ];

    const prices = [
      {
        id: 'price-1',
        symbol_id: 'symbol-quote',
        price: 60,
        price_currency: 'USD',
        change_24h: 0,
        change_percent_24h: 0,
        high_24h: null,
        low_24h: null,
        asof: '2024-01-03T00:00:00Z',
        created_at: '2024-01-03T00:00:00Z'
      }
    ];

    const endDate = new Date('2024-01-04T00:00:00Z');

    const history = PortfolioCalculations.calculatePortfolioHistory(
      transactions,
      prices,
      'FIFO',
      { endDate }
    );

    expect(history[0].value).toBeCloseTo(100); // Trade price applied on first day
    expect(history[history.length - 1].value).toBeCloseTo(120); // Quote applied after its asof
    expect(history.map(point => point.cost)).toEqual([100, 100, 100, 100]);

    const symbol = {
      id: 'symbol-quote',
      owner_id: 'user-1',
      ticker: 'QUO',
      name: 'Quote Corp',
      asset_type: 'EQUITY' as const,
      exchange: 'NYSE',
      quote_currency: 'USD',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    const consolidated = PortfolioCalculations.calculateConsolidatedHoldings(
      [{ id: 'portfolio-1', name: 'Primary' }],
      transactions,
      [symbol],
      prices,
      'FIFO'
    );

    expect(consolidated[0]?.totalMarketValue).toBeCloseTo(history[history.length - 1].value);
  });
});
