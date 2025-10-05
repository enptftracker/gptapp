import React, { useState, useEffect } from 'react';
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
import { symbolService, Transaction } from '@/lib/supabase';
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
  existingTransaction?: Transaction;
  onClose?: () => void;
}

export default function TransactionForm({ 
  portfolios, 
  defaultPortfolioId,
  trigger,
  existingTransaction,
  onClose
}: TransactionFormProps) {
  const [open, setOpen] = useState(!!existingTransaction);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const { toast } = useToast();

  useEffect(() => {
    setOpen(!!existingTransaction);
  }, [existingTransaction]);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: existingTransaction ? {
      portfolioId: existingTransaction.portfolio_id,
      ticker: '', // We'll need to fetch this
      type: existingTransaction.type === 'TRANSFER' ? 'BUY' : existingTransaction.type,
      quantity: existingTransaction.quantity,
      unitPrice: existingTransaction.unit_price,
      fee: existingTransaction.fee,
      fxRate: existingTransaction.fx_rate,
      tradeCurrency: existingTransaction.trade_currency,
      tradeDate: existingTransaction.trade_date,
      notes: existingTransaction.notes || '',
    } : {
      portfolioId: defaultPortfolioId || '',
      type: 'BUY',
      quantity: 0,
      unitPrice: 0,
      fee: 0,
      fxRate: 1,
      tradeCurrency: 'USD',
      tradeDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const onSubmit = async (data: TransactionFormData) => {
    try {
      // Find or create symbol
      const symbol = await symbolService.findOrCreate(
        data.ticker,
        'EQUITY',
        data.tradeCurrency
      );

      // Update price cache with current market data
      await MarketDataService.updatePriceCache(symbol.id, data.ticker);

      if (existingTransaction) {
        // Update existing transaction
        await updateTransaction.mutateAsync({
          id: existingTransaction.id,
          updates: {
            portfolio_id: data.portfolioId,
            symbol_id: symbol.id,
            type: data.type,
            quantity: data.quantity,
            unit_price: data.unitPrice,
            fee: data.fee,
            fx_rate: data.fxRate,
            trade_currency: data.tradeCurrency,
            trade_date: data.tradeDate,
            notes: data.notes || undefined,
          }
        });
      } else {
        // Create new transaction
        await createTransaction.mutateAsync({
          portfolio_id: data.portfolioId,
          symbol_id: symbol.id,
          type: data.type,
          quantity: data.quantity,
          unit_price: data.unitPrice,
          fee: data.fee,
          fx_rate: data.fxRate,
          trade_currency: data.tradeCurrency,
          trade_date: data.tradeDate,
          notes: data.notes || undefined,
        });
      }

      setOpen(false);
      form.reset();
      onClose?.();
      
      toast({
        title: existingTransaction ? "Transaction updated" : "Transaction added",
        description: `${data.type} ${data.quantity} ${data.ticker} ${existingTransaction ? 'updated' : 'recorded'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: existingTransaction ? "Error updating transaction" : "Error adding transaction",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && onClose) {
      onClose();
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      Add Transaction
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!existingTransaction && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-xl">
            {existingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <FormField
                control={form.control}
                name="portfolioId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Portfolio</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select portfolio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {portfolios.map((portfolio) => (
                          <SelectItem key={portfolio.id} value={portfolio.id} className="text-sm">
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
                    <FormLabel className="text-sm">Symbol</FormLabel>
                    <FormControl>
                      <SymbolSearch
                        value={field.value}
                        onSelect={(ticker, name, assetType) => {
                          field.onChange(ticker);
                        }}
                        placeholder="Search for a symbol..."
                        className="w-full text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-sm">
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
                    <FormLabel className="text-sm">Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.000001"
                        className="text-sm"
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
                    <FormLabel className="text-sm">Unit Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        className="text-sm"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Fee</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        className="text-sm"
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
                    <FormLabel className="text-sm">Currency</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="USD" className="text-sm" />
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
                    <FormLabel className="text-sm">Trade Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="text-sm" />
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
                  <FormLabel className="text-sm">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes about this transaction..."
                      className="text-sm resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="text-sm">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTransaction.isPending || updateTransaction.isPending}
                className="text-sm"
              >
                {(createTransaction.isPending || updateTransaction.isPending) 
                  ? (existingTransaction ? 'Updating...' : 'Adding...') 
                  : (existingTransaction ? 'Update Transaction' : 'Add Transaction')
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
