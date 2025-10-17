import { useEffect, useMemo, useState } from 'react';
import TransactionHistory, { TransactionHistoryProps } from './TransactionHistory';
import { Transaction } from '@/lib/supabase';
import InstrumentTypeFilter, { InstrumentTypeOption } from '@/components/shared/InstrumentTypeFilter';
import { cn } from '@/lib/utils';

interface TransactionHistoryContainerProps extends Omit<TransactionHistoryProps, 'transactions'> {
  transactions: Transaction[];
  wrapperClassName?: string;
}

const DEFAULT_FILTER = 'all';

const LABEL_OVERRIDES: Record<string, string> = {
  EQUITY: 'Equities',
  ETF: 'ETFs',
  CRYPTO: 'Crypto',
  FUND: 'Funds',
  CASH: 'Cash',
  OTHER: 'Other'
};

const formatAssetTypeLabel = (value: string) => {
  if (LABEL_OVERRIDES[value]) {
    return LABEL_OVERRIDES[value];
  }

  return value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const resolveAssetType = (transaction: Transaction): string => {
  const ticker = (transaction.symbol?.ticker || 'CASH').toUpperCase();
  if (transaction.symbol?.asset_type) {
    return transaction.symbol.asset_type;
  }

  if (ticker === 'CASH') {
    return 'CASH';
  }

  return 'OTHER';
};

const buildOptions = (transactions: Transaction[]): InstrumentTypeOption[] => {
  const uniqueTypes = new Set<string>();

  transactions.forEach(transaction => {
    uniqueTypes.add(resolveAssetType(transaction));
  });

  const options = Array.from(uniqueTypes)
    .sort((a, b) => a.localeCompare(b))
    .map(type => ({
      value: type,
      label: formatAssetTypeLabel(type)
    }));

  return [{ value: DEFAULT_FILTER, label: 'All Instruments' }, ...options];
};

const filterTransactionsByType = (transactions: Transaction[], type: string) => {
  if (type === DEFAULT_FILTER) {
    return transactions;
  }

  return transactions.filter(transaction => resolveAssetType(transaction) === type);
};

export default function TransactionHistoryContainer({
  transactions,
  wrapperClassName,
  ...transactionHistoryProps
}: TransactionHistoryContainerProps) {
  const options = useMemo(() => buildOptions(transactions), [transactions]);
  const [activeFilter, setActiveFilter] = useState<string>(DEFAULT_FILTER);

  useEffect(() => {
    if (!options.some(option => option.value === activeFilter)) {
      setActiveFilter(DEFAULT_FILTER);
    }
  }, [options, activeFilter]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByType(transactions, activeFilter),
    [transactions, activeFilter]
  );

  return (
    <div className={cn('space-y-4', wrapperClassName)}>
      <InstrumentTypeFilter
        options={options}
        value={activeFilter}
        onValueChange={setActiveFilter}
        label="Filter transactions by instrument type"
      />
      <TransactionHistory transactions={filteredTransactions} {...transactionHistoryProps} />
    </div>
  );
}
