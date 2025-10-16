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
