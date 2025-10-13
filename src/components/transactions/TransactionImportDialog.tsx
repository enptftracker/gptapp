import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseCsvFile } from '@/lib/csv';
import { formatCurrency } from '@/lib/calculations';
import { useToast } from '@/hooks/use-toast';
import { symbolService, transactionService, Transaction } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface TransactionImportDialogProps {
  portfolioId: string;
  portfolioName: string;
  trigger?: React.ReactNode;
}

interface ParsedTransaction {
  type: Transaction['type'];
  ticker?: string;
  tradeCurrency: string;
  tradeDate: string;
  quantity: number;
  unitPrice: number;
  fee: number;
  fxRate: number;
  notes?: string;
  actionLabel: string;
}

type Trading212Row = Record<string, string>;

type ConvertResult = { value?: ParsedTransaction; error?: string };

const MAX_MESSAGES = 6;
const ROWS_PER_PAGE = 10;

function parseNumber(value?: string): number {
  if (!value) return 0;
  let normalized = value.replace(/\u00A0/g, '').trim();
  if (!normalized) return 0;
  normalized = normalized.replace(/[^0-9,.-]/g, '');
  if (!normalized) return 0;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = normalized.replace(/,/g, '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTradeDate(value?: string): string {
  const fallback = new Date().toISOString().split('T')[0];
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const isoCandidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsedDate = new Date(isoCandidate);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().split('T')[0];
  }

  const [datePart] = trimmed.split(' ');
  const tokens = datePart.split(/[./-]/);
  if (tokens.length === 3) {
    const [part1, part2, part3] = tokens;
    if (part1.length === 4) {
      return `${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')}`;
    }
    if (part3.length === 4) {
      return `${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    }
  }

  return fallback;
}

function mapActionToType(action: string): Transaction['type'] | null {
  const normalized = action.toLowerCase();

  if (normalized.includes('buy')) return 'BUY';
  if (normalized.includes('sell')) return 'SELL';
  if (normalized.includes('reinvest')) return 'BUY';
  if (normalized.includes('dividend')) return 'DIVIDEND';
  if (normalized.includes('interest')) return 'DIVIDEND';
  if (normalized.includes('deposit')) return 'DEPOSIT';
  if (normalized.includes('withdraw')) return 'WITHDRAW';
  if (normalized.includes('transfer')) return 'TRANSFER';
  if (normalized.includes('fee') || normalized.includes('commission') || normalized.includes('duty')) return 'FEE';

  return null;
}

function buildNotes(...parts: Array<string | undefined>): string | undefined {
  const cleaned = parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (cleaned.length === 0) return undefined;
  return cleaned.join(' • ');
}

function convertRow(row: Trading212Row): ConvertResult {
  const action = row['Action'];
  if (!action) {
    return { error: 'Missing action' };
  }

  const type = mapActionToType(action);
  if (!type) {
    return { error: `Unsupported action "${action}"` };
  }

  const ticker = row['Ticker']?.trim();
  const tradeDate = parseTradeDate(row['Time']);
  const fxRateRaw = parseNumber(row['Exchange rate']);
  const fxRate = fxRateRaw > 0 ? fxRateRaw : 1;
  const notes = buildNotes(row['Notes']);
  const name = row['Name']?.trim();
  const actionLabel = action;

  if (type === 'BUY' || type === 'SELL') {
    if (!ticker) {
      return { error: 'Missing ticker for trade' };
    }

    const quantity = Math.abs(parseNumber(row['No. of shares']));
    if (quantity <= 0) {
      return { error: 'Quantity is required for trades' };
    }

    const total = Math.abs(parseNumber(row['Total']));
    let unitPrice = Math.abs(parseNumber(row['Price / share']));
    if (unitPrice <= 0 && total > 0) {
      unitPrice = total / quantity;
    }

    if (unitPrice <= 0) {
      return { error: 'Unit price is required for trades' };
    }

    const tradeCurrency = row['Currency (Price / share)']?.trim() || row['Currency (Total)']?.trim() || 'USD';
    const fee = Math.abs(parseNumber(row['Currency conversion fee']));
    const tradeNotes = buildNotes(notes, name);

    return {
      value: {
        type,
        ticker,
        tradeCurrency: tradeCurrency || 'USD',
        tradeDate,
        quantity,
        unitPrice,
        fee,
        fxRate,
        notes: tradeNotes,
        actionLabel
      }
    };
  }

  if (type === 'DIVIDEND') {
    if (!ticker) {
      return { error: 'Missing ticker for dividend' };
    }

    const amount = Math.abs(parseNumber(row['Total'])) || Math.abs(parseNumber(row['Result']));
    if (amount <= 0) {
      return { error: 'Dividend amount is missing' };
    }

    const tradeCurrency = row['Currency (Total)']?.trim() || row['Currency (Result)']?.trim() || 'USD';
    const withholding = Math.abs(parseNumber(row['Withholding tax']));
    const dividendNotes = buildNotes(notes, name);

    return {
      value: {
        type,
        ticker,
        tradeCurrency: tradeCurrency || 'USD',
        tradeDate,
        quantity: 1,
        unitPrice: amount,
        fee: withholding,
        fxRate,
        notes: dividendNotes,
        actionLabel
      }
    };
  }

  if (type === 'DEPOSIT' || type === 'WITHDRAW' || type === 'TRANSFER') {
    const amount = Math.abs(parseNumber(row['Total']))
      || Math.abs(parseNumber(row['Currency conversion to amount']))
      || Math.abs(parseNumber(row['Currency conversion from amount']));

    if (amount <= 0) {
      return { error: 'Cash amount is missing' };
    }

    const tradeCurrency = row['Currency (Total)']?.trim()
      || row['Currency (Currency conversion to amount)']?.trim()
      || row['Currency (Currency conversion from amount)']?.trim()
      || 'USD';

    const cashNotes = buildNotes(notes, name, ticker);

    return {
      value: {
        type,
        tradeCurrency: tradeCurrency || 'USD',
        tradeDate,
        quantity: 1,
        unitPrice: amount,
        fee: 0,
        fxRate,
        notes: cashNotes,
        actionLabel
      }
    };
  }

  if (type === 'FEE') {
    const amount = Math.abs(parseNumber(row['Currency conversion fee']))
      || Math.abs(parseNumber(row['Total']))
      || Math.abs(parseNumber(row['Result']));

    if (amount <= 0) {
      return { error: 'Fee amount is missing' };
    }

    const tradeCurrency = row['Currency (Currency conversion fee)']?.trim() || row['Currency (Total)']?.trim() || 'USD';
    const feeNotes = buildNotes(notes, name, ticker);

    return {
      value: {
        type,
        tradeCurrency: tradeCurrency || 'USD',
        tradeDate,
        quantity: 1,
        unitPrice: amount,
        fee: 0,
        fxRate,
        notes: feeNotes,
        actionLabel
      }
    };
  }

  return { error: `Unsupported action "${action}"` };
}

function parseTrading212Rows(rows: Trading212Row[]) {
  const parsed: ParsedTransaction[] = [];
  const skipped: string[] = [];

  rows.forEach((row, index) => {
    const result = convertRow(row);
    if (result.value) {
      parsed.push(result.value);
    } else if (result.error) {
      skipped.push(`Row ${index + 2}: ${result.error}`);
    }
  });

  return { parsed, skipped };
}

export default function TransactionImportDialog({
  portfolioId,
  portfolioName,
  trigger
}: TransactionImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [parseMessages, setParseMessages] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const selectedCount = parsedTransactions.reduce((total, _item, index) => {
    return total + (selectedRows[index] ? 1 : 0);
  }, 0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsParsing(true);
    setParseMessages([]);
    setImportErrors([]);
    setParsedTransactions([]);
    setSelectedRows({});
    setCurrentPage(1);

    try {
      const { rows } = await parseCsvFile(file);
      const { parsed, skipped } = parseTrading212Rows(rows);
      setParsedTransactions(parsed);
      setParseMessages(skipped);
      if (parsed.length > 0) {
        const initialSelection = parsed.reduce<Record<number, boolean>>((acc, _item, index) => {
          acc[index] = true;
          return acc;
        }, {});
        setSelectedRows(initialSelection);
        setCurrentPage(1);
      }
      if (parsed.length === 0) {
        toast({
          title: 'No supported rows found',
          description: skipped.length > 0
            ? 'The CSV was parsed but no supported actions were detected.'
            : 'The CSV file appears to be empty.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse CSV file.';
      setParseMessages([message]);
      toast({
        title: 'Import failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetState = () => {
    setSelectedFileName(null);
    setParsedTransactions([]);
    setParseMessages([]);
    setImportErrors([]);
    setIsParsing(false);
    setIsImporting(false);
    setSelectedRows({});
    setCurrentPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleImport = async () => {
    if (parsedTransactions.length === 0) return;

    const rowsToImport = parsedTransactions.filter((_, index) => selectedRows[index]);
    if (rowsToImport.length === 0) {
      toast({
        title: 'No rows selected',
        description: 'Select at least one row to import before confirming.',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportErrors([]);

    const failures: string[] = [];
    let successCount = 0;

    try {
      for (const item of rowsToImport) {
        try {
          const identifier = item.ticker ? `${item.actionLabel} ${item.ticker}` : item.actionLabel;

          let symbolId: string | undefined;

          if (item.ticker) {
            const symbol = await symbolService.findOrCreate(item.ticker, 'EQUITY', item.tradeCurrency);
            symbolId = symbol.id;
          }

          await transactionService.create({
            portfolio_id: portfolioId,
            symbol_id: symbolId,
            type: item.type,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            fee: item.fee,
            fx_rate: item.fxRate,
            trade_currency: item.tradeCurrency,
            trade_date: item.tradeDate,
            notes: item.notes
          });

          successCount += 1;

        } catch (error) {
          console.error('Transaction import failed', error);
          const reason = error instanceof Error ? error.message : 'Unknown error';
          const identifier = item.ticker ? `${item.actionLabel} ${item.ticker}` : item.actionLabel;
          failures.push(`${identifier}: ${reason}`);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions', 'portfolio', portfolioId] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['holdings', portfolioId] }),
        queryClient.invalidateQueries({ queryKey: ['metrics', portfolioId] }),
        queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
        queryClient.invalidateQueries({ queryKey: ['holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['consolidated-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['market-data'] })
      ]);

      if (successCount > 0) {
        toast({
          title: 'Import complete',
          description: `Imported ${successCount} transaction${successCount === 1 ? '' : 's'} into ${portfolioName}.`
        });
      }

      if (failures.length > 0) {
        setImportErrors(failures);
        toast({
          title: 'Some rows could not be imported',
          description: `${failures.length} row${failures.length === 1 ? '' : 's'} failed.`,
          variant: 'destructive'
        });
      } else {
        handleOpenChange(false);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const renderReview = () => {
    if (parsedTransactions.length === 0) return null;

    const totalPages = Math.max(1, Math.ceil(parsedTransactions.length / ROWS_PER_PAGE));
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const pageItems = parsedTransactions.slice(startIndex, startIndex + ROWS_PER_PAGE);

    const handleSelectAllChange = (checked: boolean) => {
      const updated = { ...selectedRows };
      parsedTransactions.forEach((_item, index) => {
        updated[index] = checked;
      });
      setSelectedRows(updated);
    };

    const allSelected = parsedTransactions.length > 0 && selectedCount === parsedTransactions.length;
    const someSelected = selectedCount > 0 && selectedCount < parsedTransactions.length;

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Review parsed transactions</p>
            <p className="text-xs text-muted-foreground">
              Verify the details below and deselect any rows that should be excluded before confirming the import.
            </p>
          </div>
          <Badge variant="secondary">{selectedCount} selected</Badge>
        </div>
        <div className="rounded-md border">
          <div className="w-full overflow-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={value => handleSelectAllChange(value !== false)}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((item, index) => {
                const globalIndex = startIndex + index;
                const amount = formatCurrency(item.unitPrice * item.quantity, item.tradeCurrency);
                return (
                  <TableRow key={`${item.actionLabel}-${item.ticker ?? globalIndex}`} data-state={selectedRows[globalIndex] ? 'selected' : undefined}>
                    <TableCell className="w-12">
                      <Checkbox
                        checked={Boolean(selectedRows[globalIndex])}
                        onCheckedChange={value =>
                          setSelectedRows(prev => ({
                            ...prev,
                            [globalIndex]: Boolean(value)
                          }))
                        }
                        aria-label={`Toggle row ${globalIndex + 1}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.type}</TableCell>
                    <TableCell>{item.ticker ?? '—'}</TableCell>
                    <TableCell>{item.tradeDate}</TableCell>
                    <TableCell className="text-right">{amount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </div>
        </div>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={event => {
                    event.preventDefault();
                    setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));
                  }}
                  className={cn(currentPage === 1 ? 'pointer-events-none opacity-50' : undefined)}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={event => {
                      event.preventDefault();
                      setCurrentPage(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={event => {
                    event.preventDefault();
                    setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
                  }}
                  className={cn(currentPage === totalPages ? 'pointer-events-none opacity-50' : undefined)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    );
  };

  const renderMessages = (messages: string[], title: string, variant: 'info' | 'warning' | 'error') => {
    if (messages.length === 0) return null;

    const displayMessages = messages.slice(0, MAX_MESSAGES);
    const remaining = messages.length - displayMessages.length;

    return (
      <div
        className={
          variant === 'error'
            ? 'rounded-md border border-destructive/40 bg-destructive/10 p-3'
            : variant === 'warning'
              ? 'rounded-md border border-amber-200 bg-amber-50 p-3'
              : 'rounded-md border border-muted p-3'
        }
      >
        <p
          className={cn(
            'text-sm font-medium',
            variant === 'error'
              ? 'text-destructive'
              : variant === 'warning'
                ? 'text-amber-900'
                : 'text-foreground'
          )}
        >
          {title}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {displayMessages.map((message, index) => (
            <li key={`${title}-${index}`}>{message}</li>
          ))}
          {remaining > 0 && <li>+ {remaining} more…</li>}
        </ul>
      </div>
    );
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Upload className="mr-2 h-4 w-4" />
      Import CSV
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="flex h-full max-h-[90vh] w-full max-w-[min(100vw-2rem,48rem)] flex-col overflow-hidden p-0">
        <div className="space-y-2 border-b px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Import Trading 212 CSV</DialogTitle>
            <DialogDescription>
              Upload the exported CSV file from Trading 212 to import trades, dividends, cash movements, and fees. After parsing, review
              every supported row before confirming the import.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="rounded-md border border-dashed p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={isParsing || isImporting}
              className="mx-auto block w-full cursor-pointer text-sm"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Actions such as buys, sells, dividends, deposits, withdrawals, and fees are supported.
            </p>
            {isParsing && (
              <p className="mt-2 text-xs text-muted-foreground">Parsing file…</p>
            )}
            {selectedFileName && (
              <p className="mt-2 text-sm font-medium">{selectedFileName}</p>
            )}
          </div>

          {renderReview()}

          {renderMessages(parseMessages, `Rows skipped (${parseMessages.length})`, 'info')}

          {renderMessages(importErrors, `Import errors (${importErrors.length})`, 'error')}
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          {parsedTransactions.length > 0 && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={isParsing || isImporting || selectedCount === 0}
            >
              {isImporting ? 'Importing…' : `Confirm import (${selectedCount})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
