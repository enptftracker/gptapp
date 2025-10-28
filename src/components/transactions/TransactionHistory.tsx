import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/calculations';
import { format } from 'date-fns';
import { Transaction } from '@/lib/supabase';
import { Edit, Trash2 } from 'lucide-react';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import TransactionForm from './TransactionForm';
import TransactionImportDialog from './TransactionImportDialog';
import { InstrumentIcon } from '@/components/shared/InstrumentIcon';

export interface TransactionHistoryProps {
  transactions: Transaction[];
  title?: string;
  className?: string;
  portfolios?: Array<{ id: string; name: string }>;
  defaultPortfolioId?: string;
}

const transactionTypeStyles: Record<
  Transaction['type'] | 'DEFAULT',
  { badge: string; row: string; stickyCell: string; hover: string }
> = {
  BUY: {
    badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200',
    row: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    stickyCell: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    hover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50'
  },
  DIVIDEND: {
    badge: 'bg-lime-100 text-lime-900 dark:bg-lime-900/60 dark:text-lime-200',
    row: 'bg-lime-50/80 dark:bg-lime-950/40',
    stickyCell: 'bg-lime-50/80 dark:bg-lime-950/40',
    hover: 'hover:bg-lime-100/80 dark:hover:bg-lime-900/50'
  },
  SELL: {
    badge: 'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-200',
    row: 'bg-red-50/80 dark:bg-red-950/40',
    stickyCell: 'bg-red-50/80 dark:bg-red-950/40',
    hover: 'hover:bg-red-100/80 dark:hover:bg-red-900/50'
  },
  DEPOSIT: {
    badge: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30'
  },
  WITHDRAW: {
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30'
  },
  FEE: {
    badge: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30'
  },
  DEFAULT: {
    badge: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30'
  }
};

export default function TransactionHistory({
  transactions,
  title = "Transaction History",
  className,
  portfolios = [],
  defaultPortfolioId
}: TransactionHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const deleteTransaction = useDeleteTransaction();

  const importPortfolio = useMemo(() => {
    if (defaultPortfolioId) {
      return portfolios.find(portfolio => portfolio.id === defaultPortfolioId) || null;
    }
    return portfolios.length > 0 ? portfolios[0] : null;
  }, [defaultPortfolioId, portfolios]);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteTransaction.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
              <p className="text-sm md:text-base text-muted-foreground">No transactions to display</p>
              {importPortfolio && (
                <TransactionImportDialog
                  portfolioId={importPortfolio.id}
                  portfolioName={importPortfolio.name}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
            {importPortfolio && (
              <TransactionImportDialog
                portfolioId={importPortfolio.id}
                portfolioName={importPortfolio.name}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Date</TableHead>
                  <TableHead className="text-xs md:text-sm">Type</TableHead>
                  <TableHead className="sticky left-0 z-20 bg-background text-xs md:text-sm">Instrument</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Quantity</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Unit Price</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Total Value</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Fee</TableHead>
                  <TableHead className="text-xs md:text-sm hidden lg:table-cell">Notes</TableHead>
                  <TableHead className="text-xs md:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => {
                  const totalValue = transaction.quantity * transaction.unit_price;
                  const ticker = (transaction.symbol?.ticker || 'CASH').toUpperCase();
                  const name = transaction.symbol?.name || (ticker === 'CASH' ? 'Cash' : '—');
                  const assetType = transaction.symbol?.asset_type || (ticker === 'CASH' ? 'CASH' : '');
                  const secondaryLabel = transaction.symbol?.exchange || '';
                  const badgeParts = [assetType, ticker, secondaryLabel]
                    .filter(Boolean)
                    .map((part) => String(part).toUpperCase());
                  const badgeLabel = badgeParts.length > 0 ? badgeParts.join(' · ') : ticker;
                  const { badge, row, stickyCell, hover } =
                    transactionTypeStyles[transaction.type] ?? transactionTypeStyles.DEFAULT;

                  return (
                    <TableRow
                      key={transaction.id}
                      className={`${row} ${hover} data-[state=selected]:bg-muted`}
                    >
                      <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                        {format(new Date(transaction.trade_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${badge} text-xs`}>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`sticky left-0 z-10 ${stickyCell} text-xs md:text-sm`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium uppercase tracking-wide text-[0.7rem] md:text-xs truncate">{name}</p>
                            <Badge
                              variant="secondary"
                              className="mt-1 w-fit text-[0.6rem] uppercase tracking-wide"
                            >
                              {badgeLabel}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs md:text-sm">
                        {transaction.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs md:text-sm">
                        {formatCurrency(transaction.unit_price, transaction.trade_currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-xs md:text-sm">
                        {formatCurrency(totalValue, transaction.trade_currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs md:text-sm">
                        {transaction.fee > 0 ? formatCurrency(transaction.fee, transaction.trade_currency) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-32 truncate hidden lg:table-cell">
                        {transaction.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8"
                            onClick={() => setEditTransaction(transaction)}
                          >
                            <Edit className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 md:h-8 md:w-8 text-destructive"
                            onClick={() => setDeleteId(transaction.id)}
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTransaction && portfolios.length > 0 && (
        <TransactionForm
          portfolios={portfolios}
          defaultPortfolioId={editTransaction.portfolio_id}
          existingTransaction={editTransaction}
          onClose={() => setEditTransaction(null)}
        />
      )}
    </>
  );
}
