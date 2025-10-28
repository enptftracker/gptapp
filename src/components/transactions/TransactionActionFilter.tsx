import { useId } from 'react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { getTransactionTypeStyles } from './transactionStyles';

export interface TransactionActionOption {
  value: string;
  label: string;
}

interface TransactionActionFilterProps {
  options: TransactionActionOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  className?: string;
  label?: string;
}

export default function TransactionActionFilter({
  options,
  value,
  onValueChange,
  className,
  label = 'Filter transactions by action type'
}: TransactionActionFilterProps) {
  const labelId = useId();
  const defaultValue = options[0]?.value;
  const optionValues = options.map(option => option.value);
  const nonDefaultOptionValues = optionValues.filter(optionValue => optionValue !== defaultValue);
  const normalizedValue = (() => {
    if (!defaultValue) {
      return value;
    }

    if (value.length === 0) {
      return [defaultValue];
    }

    const includesDefault = value.includes(defaultValue);
    const nonDefaultSelections = value.filter(optionValue => optionValue !== defaultValue);
    const hasEveryNonDefaultSelected =
      nonDefaultSelections.length === nonDefaultOptionValues.length &&
      nonDefaultOptionValues.every(optionValue => nonDefaultSelections.includes(optionValue));

    if ((includesDefault && value.length > 1) || (!includesDefault && hasEveryNonDefaultSelected)) {
      return optionValues;
    }

    return value;
  })();

  const handleToggleChange = (nextValue: string[]) => {
    if (!defaultValue) {
      onValueChange(nextValue);
      return;
    }

    const validSelections = nextValue.filter(optionValue => optionValues.includes(optionValue));
    const includesDefault = validSelections.includes(defaultValue);
    const nonDefaultSelections = validSelections.filter(optionValue => optionValue !== defaultValue);
    const hasAllNonDefaultSelections =
      nonDefaultSelections.length === nonDefaultOptionValues.length &&
      nonDefaultOptionValues.every(optionValue => nonDefaultSelections.includes(optionValue));

    if (validSelections.length === 0) {
      onValueChange([defaultValue]);
      return;
    }

    if (includesDefault && nonDefaultSelections.length === 0) {
      onValueChange([defaultValue]);
      return;
    }

    if (includesDefault && value.includes(defaultValue) && value.length === 1 && nonDefaultSelections.length > 0) {
      onValueChange(nonDefaultSelections);
      return;
    }

    if (includesDefault) {
      onValueChange([defaultValue]);
      return;
    }

    if (hasAllNonDefaultSelections) {
      onValueChange([defaultValue]);
      return;
    }

    onValueChange(nonDefaultSelections);
  };

  return (
    <div className={cn('flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end', className)}>
      <Label id={labelId} className="text-sm font-medium text-muted-foreground sm:hidden">
        {label}
      </Label>

      <div className="w-full overflow-x-auto sm:w-auto">
        <ToggleGroup
          type="multiple"
          value={normalizedValue}
          onValueChange={handleToggleChange}
          className="flex min-w-max items-center gap-2 sm:min-w-0 sm:w-full sm:flex-wrap sm:justify-end"
          aria-label={label}
          aria-labelledby={labelId}
        >
          {options.map(option => {
            const styles = getTransactionTypeStyles(option.value);

            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className={cn(
                  'relative h-auto whitespace-nowrap rounded-full border border-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-sm',
                  'data-[state=off]:bg-transparent data-[state=off]:hover:bg-muted/50 data-[state=off]:dark:hover:bg-muted/30',
                  styles.button,
                  styles.buttonHover
                )}
              >
                {option.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
    </div>
  );
}
