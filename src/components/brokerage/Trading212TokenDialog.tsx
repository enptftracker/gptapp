import { FormEvent, useCallback, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useBrokerageConnections } from '@/hooks/useBrokerageConnections';

const TRADING_212_PROVIDER = 'trading212' as const;

type Trading212TokenDialogProps = ButtonProps;

export function Trading212TokenDialog({ children, ...buttonProps }: Trading212TokenDialogProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const { provideToken } = useBrokerageConnections({ disableList: true });

  const resetForm = useCallback(() => {
    setToken('');
    setAcknowledged(false);
    provideToken.reset();
  }, [provideToken]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
      }
    },
    [resetForm]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      try {
        await provideToken.mutateAsync({
          provider: TRADING_212_PROVIDER,
          token
        });
        setOpen(false);
        resetForm();
      } catch (error) {
        console.error('Failed to submit Trading 212 API token', error);
      }
    },
    [provideToken, token, resetForm]
  );

  const isSubmitting = provideToken.isPending;
  const isSubmitDisabled = isSubmitting || !acknowledged || token.trim().length === 0;
  const triggerLabel = children ?? 'Link Trading 212 via API token';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button {...buttonProps} disabled={isSubmitting}>
          <KeyRound className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Linking…' : triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Securely link Trading 212
            </DialogTitle>
            <DialogDescription>
              Paste your Trading 212 API token below. It will be encrypted and used only to sync your holdings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="trading212-token" className="flex items-center gap-2 text-sm font-medium">
              Trading 212 API token
            </Label>
            <Textarea
              id="trading212-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your API token here"
              rows={4}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              Make sure you generate a read-only token in your Trading 212 account. You can revoke it at any time.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/40 p-3">
            <Checkbox
              id="trading212-token-confirm"
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="trading212-token-confirm" className="text-xs leading-relaxed text-muted-foreground">
              I confirm that this device is private and I authorize storing my Trading 212 token so I can sync my
              portfolio.
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? 'Saving token…' : 'Save token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
