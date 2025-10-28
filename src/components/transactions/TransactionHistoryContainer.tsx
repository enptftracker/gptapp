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

const filterTransactionsByType = (transactions: Transaction[], selectedTypes: string[]) => {
  if (selectedTypes.length === 0 || selectedTypes.includes(DEFAULT_INSTRUMENT_FILTER)) {
    return transactions;
  }

  const typeSet = new Set(selectedTypes);
  return transactions.filter(transaction => typeSet.has(resolveAssetType(transaction)));
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

const filterTransactionsByAction = (transactions: Transaction[], selectedActions: string[]) => {
  if (selectedActions.length === 0 || selectedActions.includes(DEFAULT_ACTION_FILTER)) {
    return transactions;
  }

  const actionSet = new Set(selectedActions);
  return transactions.filter(transaction => actionSet.has(transaction.type));
};

const sanitizeSelection = (selected: string[], options: { value: string }[], defaultValue: string) => {
  if (options.length === 0) {
    return selected;
  }

  const optionValues = options.map(option => option.value);
  if (!optionValues.includes(defaultValue)) {
    const fallbackValue = optionValues[0];
    return fallbackValue ? [fallbackValue] : selected;
  }

  const nonDefaultOptionValues = optionValues.filter(optionValue => optionValue !== defaultValue);
  const validValues = new Set(optionValues);
  const filtered = Array.from(new Set(selected.filter(value => validValues.has(value))));

  if (filtered.length === 0) {
    return [defaultValue];
  }

  const includesDefault = filtered.includes(defaultValue);
  const nonDefaultSelections = filtered.filter(value => value !== defaultValue);
  const hasAllNonDefaultSelections =
    nonDefaultSelections.length === nonDefaultOptionValues.length &&
    nonDefaultOptionValues.every(optionValue => nonDefaultSelections.includes(optionValue));

  if (includesDefault) {
    return [defaultValue];
  }

  if (hasAllNonDefaultSelections) {
    return [defaultValue];
  }

  if (nonDefaultSelections.length === 0) {
    return [defaultValue];
  }

  return nonDefaultSelections;
};

export default function TransactionHistoryContainer({
  transactions,
  wrapperClassName,
  ...transactionHistoryProps
}: TransactionHistoryContainerProps) {
  const instrumentOptions = useMemo(() => buildInstrumentOptions(transactions), [transactions]);
  const [activeInstrumentFilter, setActiveInstrumentFilter] = useState<string[]>([DEFAULT_INSTRUMENT_FILTER]);
  const [availableActionTypes, setAvailableActionTypes] = useState<Transaction['type'][]>(
    () => getUniqueTransactionTypes(transactions)
  );
  const [activeActionFilter, setActiveActionFilter] = useState<string[]>([DEFAULT_ACTION_FILTER]);

  const actionOptions = useMemo(
    () => buildActionOptions(availableActionTypes),
    [availableActionTypes]
  );

  useEffect(() => {
    setActiveInstrumentFilter(previous => {
      const sanitized = sanitizeSelection(previous, instrumentOptions, DEFAULT_INSTRUMENT_FILTER);
      const hasChanged =
        sanitized.length !== previous.length ||
        sanitized.some(value => !previous.includes(value)) ||
        previous.some(value => !sanitized.includes(value));

      return hasChanged ? sanitized : previous;
    });
  }, [instrumentOptions]);

  useEffect(() => {
    const nextActionTypes = getUniqueTransactionTypes(transactions);
    setAvailableActionTypes(nextActionTypes);

    setActiveActionFilter(previous => {
      const actionOptionsForSanitization = buildActionOptions(nextActionTypes);
      const sanitized = sanitizeSelection(previous, actionOptionsForSanitization, DEFAULT_ACTION_FILTER);
      const hasChanged =
        sanitized.length !== previous.length ||
        sanitized.some(value => !previous.includes(value)) ||
        previous.some(value => !sanitized.includes(value));

      return hasChanged ? sanitized : previous;
    });
  }, [transactions]);

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
