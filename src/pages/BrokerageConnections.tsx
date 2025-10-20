import { useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BrokerageOAuthLaunchButton,
  ConnectionStatusBadge,
  LastSyncDetails,
  Trading212TokenDialog
} from '@/components/brokerage';
import { useBrokerageConnections } from '@/hooks/useBrokerageConnections';
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

export default function BrokerageConnections() {
  const { connections, isLoading, sync, disconnect } = useBrokerageConnections();
  const [connectionToRemove, setConnectionToRemove] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brokerage connections</h1>
          <p className="text-muted-foreground">
            Link a supported brokerage to sync accounts, positions, and balances into your portfolios.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <BrokerageOAuthLaunchButton size="sm" className="w-full sm:w-auto" />
          <Trading212TokenDialog
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl">Linked brokerages</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review connection health, trigger a manual sync, or disconnect access.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <BrokerageOAuthLaunchButton variant="outline" size="sm" className="w-full sm:w-auto">
              Add another brokerage
            </BrokerageOAuthLaunchButton>
            <Trading212TokenDialog
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              Link Trading 212 via API token
            </Trading212TokenDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your brokerage connections…</p>
          ) : connections.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No brokerages linked yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your brokerage to keep holdings up to date automatically.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <BrokerageOAuthLaunchButton className="sm:w-auto">Connect a brokerage</BrokerageOAuthLaunchButton>
                <Trading212TokenDialog className="sm:w-auto">
                  Link Trading 212 via API token
                </Trading212TokenDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {connections.map((connection, index) => (
                <div key={connection.id} className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{connection.provider}</p>
                      <LastSyncDetails
                        lastSyncedAt={connection.last_synced_at}
                        accessTokenExpiresAt={connection.access_token_expires_at}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ConnectionStatusBadge status={connection.status} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sync.mutate(connection.id)}
                        disabled={sync.isPending}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {sync.isPending ? 'Syncing…' : 'Sync now'}
                      </Button>
                      <AlertDialog
                        open={connectionToRemove === connection.id}
                        onOpenChange={(open) => setConnectionToRemove(open ? connection.id : null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Disconnect
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect brokerage</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke access for <strong>{connection.provider}</strong>. You can reconnect at any time.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => disconnect.mutate(connection.id)}
                              disabled={disconnect.isPending}
                            >
                              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {index < connections.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
