import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/calculations';
import { format } from 'date-fns';
import { TransactionWithSymbol } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { usePortfolios } from '@/hooks/usePortfolios';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

interface TransactionHistoryProps {
  transactions: TransactionWithSymbol[];
  title?: string;
  className?: string;
  portfolios?: Array<{ id: string; name: string }>;
}

const getTransactionTypeColor = (type: TransactionWithSymbol['type']) => {
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
  portfolios
}: TransactionHistoryProps) {
  const { data: fallbackPortfolios = [] } = usePortfolios();
  const deleteTransaction = useDeleteTransaction();
  const availablePortfolios = portfolios || fallbackPortfolios;

  if (transactions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-muted-foreground">No transactions to display</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const totalValue = transaction.quantity * transaction.unit_price;
                const currentPrice = transaction.symbol?.price_cache?.price ?? null;
                const priceCurrency = transaction.symbol?.price_cache?.price_currency || transaction.trade_currency;

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {format(new Date(transaction.trade_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getTransactionTypeColor(transaction.type)}>
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {transaction.symbol ? (
                        <div className="flex flex-col">
                          <span>{transaction.symbol.ticker}</span>
                          <span className="text-xs text-muted-foreground">
                            {transaction.symbol.name || transaction.symbol.ticker}
                          </span>
                          <Badge variant="outline" className="mt-1 w-fit text-xs">
                            {transaction.symbol.asset_type}
                          </Badge>
                        </div>
                      ) : (
                        'CASH'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {transaction.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(transaction.unit_price, transaction.trade_currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {currentPrice ? formatCurrency(currentPrice, priceCurrency) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(totalValue, transaction.trade_currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {transaction.fee > 0 ? formatCurrency(transaction.fee, transaction.trade_currency) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-32 truncate">
                      {transaction.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TransactionForm
                          portfolios={availablePortfolios}
                          defaultPortfolioId={transaction.portfolio_id}
                          transaction={transaction}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete transaction</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently remove the transaction
                                from your records.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTransaction.mutateAsync({
                                  id: transaction.id,
                                  portfolioId: transaction.portfolio_id,
                                })}
                                disabled={deleteTransaction.isPending}
                              >
                                {deleteTransaction.isPending ? 'Deleting...' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
  );
}