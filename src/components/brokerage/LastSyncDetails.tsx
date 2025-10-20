import { formatDistanceToNow, isValid, parseISO } from 'date-fns';

interface LastSyncDetailsProps {
  lastSyncedAt?: string | null;
  accessTokenExpiresAt?: string | null;
  className?: string;
}

const toDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

export function LastSyncDetails({ lastSyncedAt, accessTokenExpiresAt, className }: LastSyncDetailsProps) {
  const lastSynced = toDate(lastSyncedAt);
  const expiresAt = toDate(accessTokenExpiresAt);

  const lastSyncLabel = lastSynced
    ? `${formatDistanceToNow(lastSynced, { addSuffix: true })}`
    : 'Never synced';

  let expiryLabel: string | null = null;
  if (expiresAt) {
    const distance = formatDistanceToNow(expiresAt, { addSuffix: true });
    expiryLabel = expiresAt.getTime() > Date.now() ? `Token refresh due ${distance}` : `Token expired ${distance}`;
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">Last synced: {lastSyncLabel}</p>
      {expiryLabel ? <p className="text-xs text-muted-foreground">{expiryLabel}</p> : null}
    </div>
  );
}
