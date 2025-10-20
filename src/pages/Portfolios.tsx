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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BrokerageOAuthLaunchButton } from '@/components/brokerage';

const BrokerageOnboardingCallout = () => (
  <Alert className="bg-muted/60">
    <AlertTitle>Link your brokerage</AlertTitle>
    <AlertDescription>
      Connect a supported brokerage to import real positions automatically. You can complete setup now or manage connections later from the brokerage screen.
    </AlertDescription>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <BrokerageOAuthLaunchButton size="sm" className="w-full sm:w-auto" />
      <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
        <Link to="/brokerage">Manage connections</Link>
      </Button>
    </div>
  </Alert>
);

const PortfolioCard = ({ portfolio, portfolios }: { portfolio: any; portfolios: any[] }) => {
  const { data: metrics } = usePortfolioMetrics(portfolio.id);
  const deletePortfolio = useDeletePortfolio();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isProfit = (metrics?.totalPL || 0) >= 0;
  const hasHoldings = (metrics?.holdings.length || 0) > 0;

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    try {
      await deletePortfolio.mutateAsync(portfolio.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete portfolio:', error);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base md:text-lg truncate">
              <Link
                to={`/portfolios/${portfolio.id}`}
                className="hover:underline"
              >
                {portfolio.name}
              </Link>
            </CardTitle>
            {portfolio.description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                {portfolio.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasHoldings ? "default" : "outline"} className="flex-shrink-0 text-xs">
              {metrics?.holdings.length || 0} holdings
            </Badge>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete portfolio</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the portfolio and its associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletePortfolio.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    disabled={deletePortfolio.isPending}
                  >
                    {deletePortfolio.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">Total Value</span>
            <span className="font-mono font-semibold text-sm md:text-base">
              {formatCurrency(metrics?.totalEquity || 0)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">Total P/L</span>
            <div className="flex items-center gap-2">
              {isProfit ? (
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
              )}
              <span className={cn(
                "font-mono font-semibold text-sm md:text-base",
                isProfit ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(metrics?.totalPL || 0)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">P/L %</span>
            <span className={cn(
              "font-mono font-semibold text-sm md:text-base",
              isProfit ? "text-green-600" : "text-red-600"
            )}>
              {formatPercent(metrics?.totalPLPercent || 0)}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs md:text-sm" asChild>
              <Link to={`/portfolios/${portfolio.id}`}>
                <BarChart3 className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                Details
              </Link>
            </Button>
            <TransactionForm
              portfolios={portfolios}
              defaultPortfolioId={portfolio.id}
              trigger={
                <Button size="sm" className="flex-1 text-xs md:text-sm">
                  <Plus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const { toast } = useToast();

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
                <div className="space-y-4">
                  <BrokerageOnboardingCallout />
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
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Portfolios</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage and track your investment portfolios
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="text-sm md:text-base w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Portfolio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Portfolio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <BrokerageOnboardingCallout />
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((portfolio) => (
          <PortfolioCard key={portfolio.id} portfolio={portfolio} portfolios={portfolios} />
        ))}
      </div>
    </div>
  );
}