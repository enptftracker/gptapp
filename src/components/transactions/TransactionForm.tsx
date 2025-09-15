import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SymbolSearch } from '@/components/ui/symbol-search';
import { useCreateTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { symbolService, TransactionWithSymbol, Symbol as DbSymbol } from '@/lib/supabase';
import { MarketDataService } from '@/lib/marketData';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const transactionSchema = z.object({
  portfolioId: z.string().min(1, 'Portfolio is required'),
  ticker: z.string().min(1, 'Symbol is required'),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE']),
  quantity: z.number().min(0, 'Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be positive'),
  fee: z.number().min(0, 'Fee must be positive').default(0),
  fxRate: z.number().min(0, 'FX rate must be positive').default(1),
  tradeCurrency: z.string().default('USD'),
  tradeDate: z.string().min(1, 'Trade date is required'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  portfolios: Array<{ id: string; name: string }>;
  defaultPortfolioId?: string;
  trigger?: React.ReactNode;
  transaction?: TransactionWithSymbol | null;
  onCompleted?: () => void;
}

export default function TransactionForm({
  portfolios,
  defaultPortfolioId,
  trigger,
  transaction,
  onCompleted
}: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const { toast } = useToast();
  const isEditMode = Boolean(transaction);

  const getDefaultValues = useCallback((): TransactionFormData => ({
    portfolioId: defaultPortfolioId || '',
    ticker: '',
    type: 'BUY',
    quantity: 0,
    unitPrice: 0,
    fee: 0,
    fxRate: 1,
    tradeCurrency: 'USD',
    tradeDate: new Date().toISOString().split('T')[0],
    notes: '',
  }), [defaultPortfolioId]);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (isEditMode && transaction && open) {
      form.reset({
        portfolioId: transaction.portfolio_id,
        ticker: transaction.symbol?.ticker || '',
        type: transaction.type,
        quantity: Number(transaction.quantity),
        unitPrice: Number(transaction.unit_price),
        fee: Number(transaction.fee),
        fxRate: Number(transaction.fx_rate),
        tradeCurrency: transaction.trade_currency,
        tradeDate: new Date(transaction.trade_date).toISOString().split('T')[0],
        notes: transaction.notes || '',
      });
    }

    if (!open && !isEditMode) {
      form.reset(getDefaultValues());
    }
  }, [form, getDefaultValues, isEditMode, open, transaction]);

  const onSubmit = async (data: TransactionFormData) => {
    let symbolId: string;

    try {
      const assetType: DbSymbol['asset_type'] = transaction?.symbol?.asset_type || 'EQUITY';
      const symbol = await symbolService.findOrCreate(
        data.ticker,
        assetType,
        data.tradeCurrency
      );
      symbolId = symbol.id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please check the ticker and try again.';
      toast({
        title: 'Unable to find symbol',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    try {
      await MarketDataService.updatePriceCache(symbolId, data.ticker);
    } catch (error) {
      console.warn('Failed to refresh price cache:', error);
    }

    const payload = {
      portfolio_id: data.portfolioId,
      symbol_id: symbolId,
      type: data.type,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      fee: data.fee,
      fx_rate: data.fxRate,
      trade_currency: data.tradeCurrency,
      trade_date: data.tradeDate,
      notes: data.notes || undefined,
    };

    try {
      if (isEditMode && transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          updates: payload,
        });
      } else {
        await createTransaction.mutateAsync(payload);
      }

      setOpen(false);
      form.reset(getDefaultValues());
      onCompleted?.();
    } catch (error) {
      console.error('Transaction mutation failed:', error);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Transaction
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="portfolioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portfolio</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select portfolio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {portfolios.map((portfolio) => (
                          <SelectItem key={portfolio.id} value={portfolio.id}>
                            {portfolio.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <SymbolSearch
                        value={field.value}
                        onSelect={(ticker, name, assetType) => {
                          field.onChange(ticker);
                        }}
                        placeholder="Search for a symbol..."
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BUY">Buy</SelectItem>
                        <SelectItem value="SELL">Sell</SelectItem>
                        <SelectItem value="DIVIDEND">Dividend</SelectItem>
                        <SelectItem value="DEPOSIT">Deposit</SelectItem>
                        <SelectItem value="WITHDRAW">Withdraw</SelectItem>
                        <SelectItem value="FEE">Fee</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.000001"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tradeCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="USD" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tradeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes about this transaction..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEditMode ? updateTransaction.isPending : createTransaction.isPending}
              >
                {isEditMode
                  ? updateTransaction.isPending ? 'Saving...' : 'Save Changes'
                  : createTransaction.isPending ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}