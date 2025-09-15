import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, TrendingDown, Briefcase, BarChart3, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePortfolios, useCreatePortfolio, useDeletePortfolio } from '@/hooks/usePortfolios';
import { usePortfolioMetrics } from '@/hooks/useHoldings';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import TransactionForm from '@/components/transactions/TransactionForm';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PortfolioCard = ({
  portfolio,
  portfolios,
  onDelete,
  isDeleting,
}: {
  portfolio: any;
  portfolios: any[];
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}) => {
  const { data: metrics } = usePortfolioMetrics(portfolio.id);

  const isProfit = (metrics?.totalPL || 0) >= 0;
  const hasHoldings = (metrics?.holdings.length || 0) > 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              <Link
                to={`/portfolios/${portfolio.id}`}
                className="hover:underline"
              >
                {portfolio.name}
              </Link>
            </CardTitle>
            {portfolio.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {portfolio.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasHoldings ? "default" : "outline"}>
              {metrics?.holdings.length || 0} holdings
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete portfolio</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All transactions associated with this portfolio will also be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void onDelete();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <span className="font-mono font-semibold">
              {formatCurrency(metrics?.totalEquity || 0)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total P/L</span>
            <div className="flex items-center gap-2">
              {isProfit ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={cn(
                "font-mono font-semibold",
                isProfit ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(metrics?.totalPL || 0)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">P/L %</span>
            <span className={cn(
              "font-mono font-semibold",
              isProfit ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(metrics?.totalPLPercent || 0)}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={`/portfolios/${portfolio.id}`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Details
              </Link>
            </Button>
            <TransactionForm
              portfolios={portfolios}
              defaultPortfolioId={portfolio.id}
              trigger={
                <Button size="sm" className="flex-1">
                  <Plus className="mr-2 h-4 w-4" />
                  Trade
                </Button>
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Portfolios() {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeletePortfolio = async (id: string) => {
    setDeletingId(id);
    try {
      await deletePortfolio.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete portfolio:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Portfolio name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPortfolio.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      
      setFormData({ name: '', description: '' });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create portfolio:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
            <p className="text-muted-foreground">
              Manage and track your investment portfolios
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-40 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
            <p className="text-muted-foreground">
              Manage and track your investment portfolios
            </p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No portfolios yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first portfolio to start tracking your investments
            </p>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Portfolio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Portfolio</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePortfolio} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Portfolio Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Long-term Growth"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of your investment strategy..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPortfolio.isPending}>
                      {createPortfolio.isPending ? 'Creating...' : 'Create Portfolio'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
          <p className="text-muted-foreground">
            Manage and track your investment portfolios
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Portfolio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Portfolio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreatePortfolio} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Portfolio Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Long-term Growth"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of your investment strategy..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPortfolio.isPending}>
                  {createPortfolio.isPending ? 'Creating...' : 'Create Portfolio'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              portfolios={portfolios}
              onDelete={() => handleDeletePortfolio(portfolio.id)}
              isDeleting={deletingId === portfolio.id && deletePortfolio.isPending}
            />
          ))}
        </div>
    </div>
  );
}