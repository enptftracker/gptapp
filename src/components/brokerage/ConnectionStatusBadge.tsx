import { Badge } from '@/components/ui/badge';
import type { BrokerageConnectionStatus } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<BrokerageConnectionStatus, string> = {
  pending: 'Pending authorization',
  active: 'Active',
  errored: 'Error',
  revoked: 'Revoked',
  requires_auth: 'Action required'
};

const STATUS_STYLES: Record<BrokerageConnectionStatus, string> = {
  pending: 'bg-muted text-foreground',
  active: 'bg-emerald-600 text-emerald-50 hover:bg-emerald-600/90',
  errored: 'bg-destructive text-destructive-foreground',
  revoked: 'bg-muted text-muted-foreground',
  requires_auth: 'bg-amber-500 text-amber-50 hover:bg-amber-500/90'
};

interface ConnectionStatusBadgeProps {
  status: BrokerageConnectionStatus;
  className?: string;
}

export function ConnectionStatusBadge({ status, className }: ConnectionStatusBadgeProps) {
  return (
    <Badge className={cn('capitalize', STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
