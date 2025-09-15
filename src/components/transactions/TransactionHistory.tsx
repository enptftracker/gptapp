import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/calculations';
import { format } from 'date-fns';
import { Transaction } from '@/lib/supabase';

interface TransactionHistoryProps {
  transactions: Transaction[];
  title?: string;
  className?: string;
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
  className 
}: TransactionHistoryProps) {
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
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const totalValue = transaction.quantity * transaction.unit_price;
                
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
                      {/* We'll need to join with symbols table to get ticker */}
                      {transaction.symbol_id ? 'SYMBOL' : 'CASH'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {transaction.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(transaction.unit_price, transaction.trade_currency)}
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