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

interface TransactionHistoryProps {
  transactions: Transaction[];
  title?: string;
  className?: string;
  portfolios?: Array<{ id: string; name: string }>;
  defaultPortfolioId?: string;
}

const getTransactionTypeColor = (type: Transaction['type']) => {
  switch (type) {
    case 'BUY':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'SELL':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'DIVIDEND':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'DEPOSIT':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
    case 'WITHDRAW':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'FEE':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
                  <TableHead className="text-xs md:text-sm">Symbol</TableHead>
                  <TableHead className="text-xs md:text-sm">Instrument</TableHead>
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
                  const name = transaction.symbol?.name || (ticker === 'CASH' ? 'Cash' : ticker);
                  const assetType = transaction.symbol?.asset_type || (ticker === 'CASH' ? 'CASH' : '—');
                  const secondaryLabel =
                    transaction.symbol?.exchange ||
                    (assetType !== '—' ? assetType : '');

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                        {format(new Date(transaction.trade_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getTransactionTypeColor(transaction.type)} text-xs`}>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <span className="font-mono font-medium truncate block">
                          {ticker}
                        </span>
                        <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{assetType}</p>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <InstrumentIcon ticker={ticker} name={name} size="sm" className="flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            {secondaryLabel && (
                              <p className="text-[0.65rem] text-muted-foreground truncate">{secondaryLabel}</p>
                            )}
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
