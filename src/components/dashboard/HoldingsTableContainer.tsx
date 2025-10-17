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

const filterHoldingsByType = (holdings: Holding[], type: string) => {
  if (type === DEFAULT_FILTER) {
    return holdings;
  }

  return holdings.filter(holding => (holding.symbol.assetType || 'OTHER') === type);
};

export default function HoldingsTableContainer({ holdings, wrapperClassName, ...tableProps }: HoldingsTableContainerProps) {
  const options = useMemo(() => buildOptions(holdings), [holdings]);
  const [activeFilter, setActiveFilter] = useState<string>(DEFAULT_FILTER);

  useEffect(() => {
    if (!options.some(option => option.value === activeFilter)) {
      setActiveFilter(DEFAULT_FILTER);
    }
  }, [options, activeFilter]);

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
