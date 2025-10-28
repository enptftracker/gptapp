import { useId } from 'react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
  const selectId = useId();

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <Label htmlFor={selectId} className="text-sm font-medium text-muted-foreground sm:hidden">
        {label}
      </Label>

      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={selectId} className="sm:hidden">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden sm:flex sm:w-full sm:justify-end">
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={handleToggleChange(onValueChange)}
          className="flex flex-wrap gap-2"
          aria-label={label}
        >
          {options.map(option => (
            <ToggleGroupItem key={option.value} value={option.value} className="text-xs sm:text-sm">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
