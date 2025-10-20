import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveSupabaseFunctionUrl } from '@/integrations/supabase/env';
import { useToast } from '@/hooks/use-toast';
import { brokerageConnectionService, type CreateBrokerageConnectionInput } from '@/lib/supabase';

const QUERY_KEY = ['brokerage-connections'];

interface UseBrokerageConnectionsOptions {
  disableList?: boolean;
}

interface ConnectBrokerageInput extends Pick<CreateBrokerageConnectionInput, 'provider'> {
  redirectUri?: string;
  scope?: string;
}

interface ProvideTokenInput {
  provider: CreateBrokerageConnectionInput['provider'];
  token: string;
}

interface OAuthInitiateResponse {
  authorizationUrl?: string;
  state?: string;
}

interface SyncResponse {
  status?: string;
  accounts?: number;
  positions?: number;
}

const ensurePath = (path: string): string => {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
    if (typeof data?.error === 'string' && data.error.trim().length > 0) {
      return data.error;
    }
  } catch (error) {
    // Ignore JSON parsing errors, fall back to text
  }

  const text = await response.text();
  if (text.trim().length > 0) {
    return text.trim();
  }

  return 'Unexpected response from brokerage service.';
};

async function invokeBrokerageFunction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('You need to be signed in to manage brokerage connections.');
  }

  const baseUrl = resolveSupabaseFunctionUrl('brokerage-sync');
  const url = `${baseUrl}${ensurePath(path)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error('Brokerage service returned an invalid response.');
  }
}

export function useBrokerageConnections(options: UseBrokerageConnectionsOptions = {}) {
  const { disableList = false } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => brokerageConnectionService.list(),
    enabled: !disableList
  });

  const connectMutation = useMutation({
    mutationFn: async ({ provider, redirectUri, scope }: ConnectBrokerageInput) => {
      const connection = await brokerageConnectionService.create({
        provider,
        status: 'pending'
      });

      try {
        const oauth = await invokeBrokerageFunction<OAuthInitiateResponse>('/oauth/initiate', {
          connectionId: connection.id,
          redirectUri,
          scope
        });

        return {
          connection,
          authorizationUrl: oauth.authorizationUrl,
          state: oauth.state
        };
      } catch (error) {
        try {
          await brokerageConnectionService.delete(connection.id);
        } catch (cleanupError) {
          console.error('Failed to clean up brokerage connection after OAuth error', cleanupError);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'Brokerage connection created',
        description: 'Continue in the newly opened window to authorize access.'
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to start the brokerage connection flow.';
      toast({
        title: 'Unable to start brokerage connection',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await brokerageConnectionService.delete(connectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'Brokerage disconnected',
        description: 'The connection has been removed.'
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect the brokerage connection.';
      toast({
        title: 'Unable to disconnect',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return invokeBrokerageFunction<SyncResponse>('/sync', { connectionId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'Sync started',
        description:
          data?.status === 'synced'
            ? 'Latest account and position data has been synced.'
            : 'The brokerage sync has been queued.'
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to start a sync for this brokerage connection.';
      toast({
        title: 'Unable to sync brokerage',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const provideTokenMutation = useMutation({
    mutationFn: async ({ provider, token }: ProvideTokenInput) => {
      const normalizedToken = token.trim();
      if (!normalizedToken) {
        throw new Error('API token is required.');
      }

      const connection = await brokerageConnectionService.create({
        provider,
        status: 'pending'
      });

      try {
        await invokeBrokerageFunction('/token/submit', {
          connectionId: connection.id,
          token: normalizedToken
        });

        const updatedConnection = await brokerageConnectionService.update(connection.id, {
          status: 'active'
        });

        return updatedConnection;
      } catch (error) {
        try {
          await brokerageConnectionService.delete(connection.id);
        } catch (cleanupError) {
          console.error('Failed to clean up brokerage connection after token submission error', cleanupError);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({
        title: 'Trading 212 linked',
        description: 'Your API token was stored securely. You can sync whenever you are ready.'
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to submit API token.';
      toast({
        title: 'Unable to link Trading 212',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const connections = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  return {
    connections,
    isLoading: !disableList && listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    connect: connectMutation,
    disconnect: disconnectMutation,
    sync: syncMutation,
    provideToken: provideTokenMutation
  } as const;
}

export type { ConnectBrokerageInput, ProvideTokenInput };
