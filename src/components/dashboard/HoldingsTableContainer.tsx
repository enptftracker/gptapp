import { useEffect, useMemo, useState } from 'react';
import HoldingsTable, { HoldingsTableProps } from './HoldingsTable';
import { Holding } from '@/lib/types';
import { cn } from '@/lib/utils';
import InstrumentTypeFilter, { InstrumentTypeOption } from '@/components/shared/InstrumentTypeFilter';

interface HoldingsTableContainerProps extends Omit<HoldingsTableProps, 'holdings'> {
  holdings: Holding[];
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

const buildOptions = (holdings: Holding[]): InstrumentTypeOption[] => {
  const uniqueTypes = new Set<string>();

  holdings.forEach(holding => {
    uniqueTypes.add(holding.symbol.assetType || 'OTHER');
  });

  const options = Array.from(uniqueTypes)
    .sort((a, b) => a.localeCompare(b))
    .map(type => ({
      value: type,
      label: formatAssetTypeLabel(type)
    }));

  return [{ value: DEFAULT_FILTER, label: 'All Instruments' }, ...options];
};

const filterHoldingsByType = (holdings: Holding[], selectedTypes: string[]) => {
  if (selectedTypes.length === 0 || selectedTypes.includes(DEFAULT_FILTER)) {
    return holdings;
  }

  const typeSet = new Set(selectedTypes);
  return holdings.filter(holding => typeSet.has(holding.symbol.assetType || 'OTHER'));
};

const sanitizeSelection = (selected: string[], options: InstrumentTypeOption[], defaultValue: string) => {
  if (options.length === 0) {
    return selected;
  }

  const optionValues = options.map(option => option.value);
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

export default function HoldingsTableContainer({ holdings, wrapperClassName, ...tableProps }: HoldingsTableContainerProps) {
  const options = useMemo(() => buildOptions(holdings), [holdings]);
  const [activeFilter, setActiveFilter] = useState<string[]>([DEFAULT_FILTER]);

  useEffect(() => {
    setActiveFilter(previous => {
      const sanitized = sanitizeSelection(previous, options, DEFAULT_FILTER);
      const hasChanged =
        sanitized.length !== previous.length ||
        sanitized.some(value => !previous.includes(value)) ||
        previous.some(value => !sanitized.includes(value));

      return hasChanged ? sanitized : previous;
    });
  }, [options]);

  const filteredHoldings = useMemo(
    () => filterHoldingsByType(holdings, activeFilter),
    [holdings, activeFilter]
  );

  return (
    <div className={cn('space-y-4', wrapperClassName)}>
      <InstrumentTypeFilter
        options={options}
        value={activeFilter}
        onValueChange={setActiveFilter}
        label="Filter holdings by instrument type"
      />
      <HoldingsTable {...tableProps} holdings={filteredHoldings} />
    </div>
  );
}
