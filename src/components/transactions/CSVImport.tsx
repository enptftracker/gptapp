import { useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { symbolService } from '@/lib/supabase';
import { MarketDataService } from '@/lib/marketData';

interface CSVImportProps {
  portfolios: Array<{ id: string; name: string }>;
  defaultPortfolioId?: string;
}

interface ParsedTransaction {
  ticker: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAW' | 'FEE';
  quantity: number;
  unitPrice: number;
  fee: number;
  tradeCurrency: string;
  tradeDate: string;
  notes?: string;
}

export function CSVImport({ portfolios, defaultPortfolioId }: CSVImportProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();

  const parseCSV = (text: string): ParsedTransaction[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV file must have at least a header row and one data row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      const getValueByHeader = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const index = headers.indexOf(name);
          if (index !== -1 && values[index]) return values[index];
        }
        return '';
      };

      const ticker = getValueByHeader(['ticker', 'symbol', 'stock']);
      const type = (getValueByHeader(['type', 'transaction_type', 'action']) || 'BUY').toUpperCase();
      const quantity = parseFloat(getValueByHeader(['quantity', 'shares', 'amount']) || '0');
      const unitPrice = parseFloat(getValueByHeader(['price', 'unit_price', 'cost']) || '0');
      const fee = parseFloat(getValueByHeader(['fee', 'commission', 'fees']) || '0');
      const tradeCurrency = getValueByHeader(['currency', 'trade_currency']) || 'USD';
      const tradeDate = getValueByHeader(['date', 'trade_date', 'transaction_date']);
      const notes = getValueByHeader(['notes', 'description', 'memo']);

      if (!ticker || !tradeDate) continue;

      // Validate type
      const validTypes = ['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAW', 'FEE'];
      const normalizedType = validTypes.includes(type) ? type as ParsedTransaction['type'] : 'BUY';

      transactions.push({
        ticker,
        type: normalizedType,
        quantity,
        unitPrice,
        fee,
        tradeCurrency,
        tradeDate: formatDate(tradeDate),
        notes: notes || undefined
      });
    }

    return transactions;
  };

  const formatDate = (dateStr: string): string => {
    // Try to parse various date formats and convert to YYYY-MM-DD
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);
      setPreview(parsed);
      
      toast({
        title: "File loaded",
        description: `Found ${parsed.length} transactions to import`
      });
    } catch (error: any) {
      toast({
        title: "Error parsing CSV",
        description: error.message,
        variant: "destructive"
      });
      setFile(null);
      setPreview([]);
    }
  };

  const handleImport = async () => {
    if (!defaultPortfolioId && portfolios.length === 0) {
      toast({
        title: "No portfolio selected",
        description: "Please select a portfolio first",
        variant: "destructive"
      });
      return;
    }

    const portfolioId = defaultPortfolioId || portfolios[0].id;
    setImporting(true);

    let successCount = 0;
    let errorCount = 0;

    for (const transaction of preview) {
      try {
        // Find or create symbol
        const symbol = await symbolService.findOrCreate(
          transaction.ticker,
          'EQUITY',
          transaction.tradeCurrency
        );

        // Update price cache
        await MarketDataService.updatePriceCache(symbol.id, transaction.ticker);

        // Create transaction
        await createTransaction.mutateAsync({
          portfolio_id: portfolioId,
          symbol_id: symbol.id,
          type: transaction.type,
          quantity: transaction.quantity,
          unit_price: transaction.unitPrice,
          fee: transaction.fee,
          fx_rate: 1,
          trade_currency: transaction.tradeCurrency,
          trade_date: transaction.tradeDate,
          notes: transaction.notes
        });

        successCount++;
      } catch (error) {
        console.error(`Error importing ${transaction.ticker}:`, error);
        errorCount++;
      }
    }

    setImporting(false);
    setOpen(false);
    setFile(null);
    setPreview([]);

    toast({
      title: "Import complete",
      description: `Successfully imported ${successCount} transactions${errorCount > 0 ? `, ${errorCount} failed` : ''}`
    });
  };

  const removeFile = () => {
    setFile(null);
    setPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Upload a CSV file with your transactions. The file should include these columns:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>ticker/symbol</strong>: Stock symbol (required)</li>
              <li><strong>type</strong>: BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAW, or FEE</li>
              <li><strong>quantity</strong>: Number of shares</li>
              <li><strong>price</strong>: Price per share</li>
              <li><strong>date</strong>: Transaction date (required)</li>
              <li><strong>fee</strong>: Transaction fee (optional)</li>
              <li><strong>currency</strong>: Currency code (optional, defaults to USD)</li>
              <li><strong>notes</strong>: Additional notes (optional)</li>
            </ul>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-6">
            {!file ? (
              <div className="text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" asChild>
                    <span>Choose CSV File</span>
                  </Button>
                </label>
                <p className="text-sm text-muted-foreground mt-2">or drag and drop</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{preview.length} transactions found</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-3">
                <h4 className="font-medium">Preview</h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Ticker</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2">Quantity</th>
                      <th className="text-right p-2">Price</th>
                      <th className="text-left p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((tx, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="p-2 font-medium">{tx.ticker}</td>
                        <td className="p-2">{tx.type}</td>
                        <td className="p-2 text-right">{tx.quantity}</td>
                        <td className="p-2 text-right">${tx.unitPrice.toFixed(2)}</td>
                        <td className="p-2">{tx.tradeDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <div className="p-2 text-center text-muted-foreground text-xs bg-muted/30">
                    ...and {preview.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={preview.length === 0 || importing}
            >
              {importing ? 'Importing...' : `Import ${preview.length} Transactions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
