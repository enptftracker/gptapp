import { useEffect, useMemo, useState } from 'react';
import TransactionHistory, { TransactionHistoryProps } from './TransactionHistory';
import TransactionActionFilter, { TransactionActionOption } from './TransactionActionFilter';
import { Transaction } from '@/lib/supabase';
import InstrumentTypeFilter, { InstrumentTypeOption } from '@/components/shared/InstrumentTypeFilter';
import { cn } from '@/lib/utils';

interface TransactionHistoryContainerProps
  extends Omit<TransactionHistoryProps, 'transactions' | 'filters'> {
  transactions: Transaction[];
  wrapperClassName?: string;
}

const DEFAULT_INSTRUMENT_FILTER = 'all';
const DEFAULT_ACTION_FILTER = 'all_actions';

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

const buildInstrumentOptions = (transactions: Transaction[]): InstrumentTypeOption[] => {
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

  return [{ value: DEFAULT_INSTRUMENT_FILTER, label: 'All Instruments' }, ...options];
};

const filterTransactionsByType = (transactions: Transaction[], type: string) => {
  if (type === DEFAULT_INSTRUMENT_FILTER) {
    return transactions;
  }

  return transactions.filter(transaction => resolveAssetType(transaction) === type);
};

const formatTransactionTypeLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getUniqueTransactionTypes = (transactions: Transaction[]): Transaction['type'][] =>
  Array.from(new Set(transactions.map(transaction => transaction.type)))
    .sort((a, b) => a.localeCompare(b)) as Transaction['type'][];

const buildActionOptions = (transactionTypes: Transaction['type'][]): TransactionActionOption[] => {
  const options = transactionTypes.map(type => ({
    value: type,
    label: formatTransactionTypeLabel(type)
  }));

  return [{ value: DEFAULT_ACTION_FILTER, label: 'All actions' }, ...options];
};

type ActionFilterValue = Transaction['type'] | typeof DEFAULT_ACTION_FILTER;

const filterTransactionsByAction = (transactions: Transaction[], action: ActionFilterValue) => {
  if (action === DEFAULT_ACTION_FILTER) {
    return transactions;
  }

  return transactions.filter(transaction => transaction.type === action);
};

export default function TransactionHistoryContainer({
  transactions,
  wrapperClassName,
  ...transactionHistoryProps
}: TransactionHistoryContainerProps) {
  const instrumentOptions = useMemo(() => buildInstrumentOptions(transactions), [transactions]);
  const [activeInstrumentFilter, setActiveInstrumentFilter] = useState<string>(DEFAULT_INSTRUMENT_FILTER);
  const [availableActionTypes, setAvailableActionTypes] = useState<Transaction['type'][]>(
    () => getUniqueTransactionTypes(transactions)
  );
  const [activeActionFilter, setActiveActionFilter] = useState<ActionFilterValue>(DEFAULT_ACTION_FILTER);

  const actionOptions = useMemo(
    () => buildActionOptions(availableActionTypes),
    [availableActionTypes]
  );

  useEffect(() => {
    if (!instrumentOptions.some(option => option.value === activeInstrumentFilter)) {
      setActiveInstrumentFilter(DEFAULT_INSTRUMENT_FILTER);
    }
  }, [instrumentOptions, activeInstrumentFilter]);

  useEffect(() => {
    const nextActionTypes = getUniqueTransactionTypes(transactions);
    setAvailableActionTypes(nextActionTypes);

    if (
      activeActionFilter !== DEFAULT_ACTION_FILTER &&
      !nextActionTypes.includes(activeActionFilter as Transaction['type'])
    ) {
      setActiveActionFilter(DEFAULT_ACTION_FILTER);
    }
  }, [transactions, activeActionFilter]);

  const filteredTransactions = useMemo(
    () => {
      const filteredByInstrument = filterTransactionsByType(transactions, activeInstrumentFilter);
      return filterTransactionsByAction(filteredByInstrument, activeActionFilter);
    },
    [transactions, activeInstrumentFilter, activeActionFilter]
  );

  const filters = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <InstrumentTypeFilter
        options={instrumentOptions}
        value={activeInstrumentFilter}
        onValueChange={setActiveInstrumentFilter}
        label="Filter transactions by instrument type"
        className="w-full lg:flex-1"
      />
      <TransactionActionFilter
        options={actionOptions}
        value={activeActionFilter}
        onValueChange={setActiveActionFilter}
        label="Filter transactions by action type"
        className="w-full lg:flex-1"
      />
    </div>
  );

  return (
    <div className={cn(wrapperClassName)}>
      <TransactionHistory
        transactions={filteredTransactions}
        filters={filters}
        {...transactionHistoryProps}
      />
    </div>
  );
}
