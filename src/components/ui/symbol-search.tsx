import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MarketDataService } from '@/lib/marketData';

interface SymbolSearchProps {
  value?: string;
  onSelect: (ticker: string, name: string, assetType: string) => void;
  placeholder?: string;
  className?: string;
}

export function SymbolSearch({ value, onSelect, placeholder = "Search symbols...", className }: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [symbols, setSymbols] = useState<Array<{ ticker: string; name: string; type: string }>>([]);

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

  const selectedSymbol = symbols.find(symbol => symbol.ticker === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {selectedSymbol ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">{selectedSymbol.ticker}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedSymbol.type}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search symbols..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>No symbols found.</CommandEmpty>
            <CommandGroup>
              {symbols.map((symbol) => (
                <CommandItem
                  key={symbol.ticker}
                  value={symbol.ticker}
                  onSelect={() => {
                    onSelect(symbol.ticker, symbol.name, symbol.type);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{symbol.ticker}</span>
                      <Badge variant="outline" className="text-xs">
                        {symbol.type}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">
                      {symbol.name}
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