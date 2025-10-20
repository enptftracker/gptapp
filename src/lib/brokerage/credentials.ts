import { supabase } from '@/integrations/supabase/client';

const BROKERAGE_UNSEAL_FUNCTION = 'brokerage-unseal-tokens';
const BROKERAGE_ROTATE_FUNCTION = 'brokerage-rotate-tokens';
const SENSITIVE_KEYS = new Set([
  'accessToken',
  'refreshToken',
  'token',
  'secret',
  'access_token',
  'refresh_token'
]);

export interface BrokerageCredentialResponse {
  success: boolean;
  taskId?: string;
  message?: string;
}

export interface UnwrapBrokerageCredentialsOptions {
  includeRefreshToken?: boolean;
  reason?: string;
}

export interface RotateBrokerageCredentialsOptions {
  reason?: string;
}

function assertNoSecrets(payload: unknown): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  const entries = Object.entries(payload as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (SENSITIVE_KEYS.has(key)) {
      throw new Error('Edge function returned sensitive credentials to the browser.');
    }

    if (value && typeof value === 'object') {
      assertNoSecrets(value);
    }
  }
}

async function invokeCredentialFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<BrokerageCredentialResponse> {
  const { data, error } = await supabase.functions.invoke<BrokerageCredentialResponse>(functionName, {
    body
  });

  if (error) {
    throw error;
  }

  assertNoSecrets(data);

  if (!data) {
    return {
      success: false,
      message: 'No response payload returned from edge function.'
    };
  }

  return data;
}

export async function requestBrokerageCredentialUnwrap(
  connectionId: string,
  options: UnwrapBrokerageCredentialsOptions = {}
): Promise<BrokerageCredentialResponse> {
  if (!connectionId) {
    throw new Error('A brokerage connection identifier is required.');
  }

  return invokeCredentialFunction(BROKERAGE_UNSEAL_FUNCTION, {
    connectionId,
    includeRefreshToken: options.includeRefreshToken ?? false,
    reason: options.reason ?? 'client_request'
  });
}

export async function requestBrokerageCredentialRotation(
  connectionId: string,
  options: RotateBrokerageCredentialsOptions = {}
): Promise<BrokerageCredentialResponse> {
  if (!connectionId) {
    throw new Error('A brokerage connection identifier is required.');
  }

  return invokeCredentialFunction(BROKERAGE_ROTATE_FUNCTION, {
    connectionId,
    reason: options.reason ?? 'client_request'
  });
}

