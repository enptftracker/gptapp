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
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  label?: string;
}

const handleToggleChange = (callback: (value: string) => void) => (nextValue: string) => {
  if (nextValue) {
    callback(nextValue);
  }
};

export default function TransactionActionFilter({
  options,
  value,
  onValueChange,
  className,
  label = 'Filter transactions by action type'
}: TransactionActionFilterProps) {
  const labelId = useId();

  return (
    <div className={cn('flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end', className)}>
      <Label id={labelId} className="text-sm font-medium text-muted-foreground sm:hidden">
        {label}
      </Label>

      <div className="w-full overflow-x-auto sm:w-auto">
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={handleToggleChange(onValueChange)}
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
                  'rounded-full border border-transparent px-4 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-sm',
                  'data-[state=off]:bg-muted data-[state=off]:text-muted-foreground data-[state=off]:hover:bg-muted/80',
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
