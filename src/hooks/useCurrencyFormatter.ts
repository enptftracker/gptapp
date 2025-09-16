import { useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { useProfile } from './useProfile';

export function useCurrencyFormatter() {
  const { data: profile } = useProfile();
  const baseCurrency = profile?.base_currency ?? 'USD';

  const formatBaseCurrency = useMemo(
    () => (value: number) => formatCurrency(value, baseCurrency),
    [baseCurrency]
  );

  return {
    baseCurrency,
    formatBaseCurrency,
  };
}
