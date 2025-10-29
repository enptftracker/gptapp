import React, { useState, useEffect, useRef, useId } from 'react';
import { Check, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarketDataService, type SymbolSearchResult } from '@/lib/marketData';

interface SymbolSearchProps {
  value?: string;
  onSelect: (ticker: string, name: string, assetType: string, quoteCurrency: string) => void;
  placeholder?: string;
  className?: string;
}

export function SymbolSearch({ value, onSelect, placeholder = "Search tickers...", className }: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [symbols, setSymbols] = useState<SymbolSearchResult[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolSearchResult | null>(null);
  const [inputValue, setInputValue] = useState(value ?? "");
  const commandListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const searchSymbols = async () => {
      if (searchQuery.length > 0) {
        const results = await MarketDataService.searchSymbols(searchQuery);
        setSymbols(results);
      } else {
        // Show popular symbols when no search
        const defaultResults = await MarketDataService.searchSymbols("");
        setSymbols(defaultResults.slice(0, 8));
      }
    };

    const debounceTimer = setTimeout(searchSymbols, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  useEffect(() => {
    if (value) {
      setInputValue(value);
      setSearchQuery(value);
    } else {
      setInputValue("");
      setSearchQuery("");
      setSelectedSymbol(null);
    }
  }, [value]);

  useEffect(() => {
    if (!value) {
      return;
    }

    const match = symbols.find((symbol) => symbol.ticker === value);
    setSelectedSymbol(match ?? null);
  }, [symbols, value]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    setSearchQuery(newValue);
    setOpen(true);
  };

  const showSelectedBadge = Boolean(selectedSymbol && inputValue === selectedSymbol.ticker);

  const handleSelect = (symbol: SymbolSearchResult) => {
    onSelect(symbol.ticker, symbol.name, symbol.assetType, symbol.quoteCurrency);
    setSelectedSymbol(symbol);
    setInputValue(symbol.ticker);
    setSearchQuery(symbol.ticker);
    setOpen(false);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      const firstItem = commandListRef.current?.querySelector('[role="option"]');
      if (firstItem instanceof HTMLElement) {
        firstItem.focus();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && inputRef.current && document.activeElement === inputRef.current) {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listId}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onKeyDown={handleInputKeyDown}
            ref={inputRef}
            className={cn('w-full pl-9 pr-24', className)}
          />
          {showSelectedBadge && selectedSymbol && (
            <Badge variant="secondary" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">
              {selectedSymbol.assetType}
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        forceMount
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="z-50 w-[90vw] max-w-[400px] p-0 bg-popover border border-border shadow-md"
        align="start"
        side="bottom"
      >
        <Command shouldFilter={false}>
          <CommandList id={listId} ref={commandListRef} className="max-h-[300px] overflow-y-auto">
            {symbols.length === 0 ? <CommandEmpty>No tickers found.</CommandEmpty> : null}
            <CommandGroup>
              {symbols.map((symbol) => (
                <CommandItem
                  key={symbol.ticker}
                  value={symbol.ticker}
                  onSelect={() => handleSelect(symbol)}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{symbol.ticker}</span>
                      <Badge variant="outline" className="text-xs">
                        {symbol.assetType}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">
                      {symbol.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Quote currency: {symbol.quoteCurrency}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === symbol.ticker ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}