import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const DEFAULT_BATCH_SIZE = toPositiveInteger(
  Deno.env.get("BROKERAGE_REFRESH_BATCH_SIZE"),
  10,
);
const DEFAULT_DELAY_MS = toNonNegativeInteger(
  Deno.env.get("BROKERAGE_REFRESH_DELAY_MS"),
  500,
);
const REFRESH_BUFFER_SECONDS = toNonNegativeInteger(
  Deno.env.get("BROKERAGE_REFRESH_EXPIRY_BUFFER_SECONDS"),
  300,
);

const getEnv = (
  key: string,
  { required = true }: { required?: boolean } = {},
): string | undefined => {
  const value = Deno.env.get(key)?.trim();
  if (!value && required) {
    throw new HttpError(`Missing required environment variable: ${key}`, 500);
  }

  return value;
};

const brokerConfig = {
  tokenUrl: () => getEnv("BROKER_OAUTH_TOKEN_URL", { required: false }),
  clientId: () => getEnv("BROKER_CLIENT_ID", { required: false }),
  clientSecret: () => getEnv("BROKER_CLIENT_SECRET", { required: false }) ?? "",
};

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  supabaseClient = createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false },
  });

  return supabaseClient;
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

type JsonRecord = Record<string, unknown>;

type BrokerageConnectionRow = {
  id: string;
  user_id: string;
  status: string;
  access_token_encrypted: string | Uint8Array | null;
  refresh_token_encrypted: string | Uint8Array | null;
  access_token_expires_at: string | null;
  metadata: JsonRecord | null;
  last_synced_at: string | null;
};

const decodeToken = (
  value: string | Uint8Array | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  try {
    if (value instanceof Uint8Array) {
      return textDecoder.decode(value);
    }

    if (typeof value === "string") {
      if (value.startsWith("\\x")) {
        const hex = value.slice(2);
        if (hex.length % 2 !== 0) {
          throw new Error("Hex token has invalid length");
        }
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
        }
        return textDecoder.decode(bytes);
      }

      const normalized = value.trim();
      if (!normalized) {
        return null;
      }

      try {
        const decoded = atob(normalized);
        return decoded ? decoded : normalized;
      } catch {
        return normalized;
      }
    }
  } catch (error) {
    console.error("Failed to decode token", error);
    throw new HttpError("Stored token could not be decoded", 500);
  }

  return null;
};

const encodeToken = (token: string | undefined | null): Uint8Array | null => {
  if (!token) {
    return null;
  }

  return textEncoder.encode(token);
};

const toIsoTimestamp = (expiresInSeconds?: number): string | null => {
  if (!expiresInSeconds || Number.isNaN(expiresInSeconds)) {
    return null;
  }

  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);
  return expiryDate.toISOString();
};

const shouldRefreshToken = (expiresAt: string | null | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiryTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryTime)) {
    return false;
  }

  const bufferMs = REFRESH_BUFFER_SECONDS * 1000;
  return expiryTime <= Date.now() + bufferMs;
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const updateConnection = async (
  supabase: SupabaseClient,
  connectionId: string,
  payload: Partial<BrokerageConnectionRow>,
): Promise<void> => {
  const { error } = await supabase
    .from("brokerage_connections")
    .update(payload)
    .eq("id", connectionId);

  if (error) {
    console.error("Failed to update brokerage connection", error);
    throw new HttpError("Unable to update brokerage connection", 500, error);
  }
};

const refreshAccessToken = async (
  supabase: SupabaseClient,
  connection: BrokerageConnectionRow,
): Promise<{ refreshed: boolean; accessToken: string | null; expiresAt: string | null }> => {
  const existingAccessToken = decodeToken(connection.access_token_encrypted);
  const refreshToken = decodeToken(connection.refresh_token_encrypted);
  const tokenUrl = brokerConfig.tokenUrl();
  const clientId = brokerConfig.clientId();
  if (!refreshToken || !tokenUrl || !clientId) {
    if (!refreshToken) {
      console.warn(`Connection ${connection.id} does not have a refresh token`);
    }
    if (!tokenUrl || !clientId) {
      console.warn("Broker OAuth configuration is incomplete; reusing existing access token");
    }
    return {
      refreshed: false,
      accessToken: existingAccessToken,
      expiresAt: connection.access_token_expires_at,
    };
  }

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);
  params.set("client_id", clientId);
  const clientSecret = brokerConfig.clientSecret();
  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const upstreamStatus = response.status;
    console.error("Broker refresh token request failed", upstreamStatus);
    if (upstreamStatus === 400 || upstreamStatus === 401) {
      await updateConnection(supabase, connection.id, { status: "requires_auth" });
    }
    throw new HttpError(
      `Broker refresh token request failed with status ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload = await response.json();
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : undefined;
  if (!accessToken) {
    console.error("Broker refresh response missing access_token", payload);
    throw new HttpError("Broker refresh response missing access_token", 502, payload);
  }

  const newRefreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : refreshToken;
  const expiresInRaw = typeof payload.expires_in === "number"
    ? payload.expires_in
    : typeof payload.expires_in === "string"
    ? Number.parseInt(payload.expires_in, 10)
    : undefined;
  const accessTokenExpiresAt = toIsoTimestamp(
    Number.isFinite(expiresInRaw ?? Number.NaN) ? expiresInRaw : undefined,
  );

  const encodedAccessToken = encodeToken(accessToken);
  const encodedRefreshToken = encodeToken(newRefreshToken);

  await updateConnection(supabase, connection.id, {
    status: "active",
    access_token_encrypted: encodedAccessToken,
    refresh_token_encrypted: encodedRefreshToken,
    access_token_expires_at: accessTokenExpiresAt,
  });

  connection.access_token_encrypted = encodedAccessToken;
  connection.refresh_token_encrypted = encodedRefreshToken;
  connection.access_token_expires_at = accessTokenExpiresAt;

  return { refreshed: true, accessToken, expiresAt: accessTokenExpiresAt };
};

const triggerSync = async (connectionId: string): Promise<void> => {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError("Supabase project configuration is missing", 500);
  }

  const overrideFunctionsUrl = getEnv("SUPABASE_EDGE_FUNCTIONS_URL", { required: false })
    ?? getEnv("SUPABASE_FUNCTIONS_URL", { required: false });

  let syncUrl: string;
  if (overrideFunctionsUrl) {
    const trimmed = overrideFunctionsUrl.replace(/\/?$/, "");
    syncUrl = `${trimmed}/brokerage-sync/sync`;
  } else {
    const projectUrl = new URL(supabaseUrl);
    const host = projectUrl.host;
    if (host.endsWith(".supabase.co")) {
      const functionsHost = host.replace(/\.supabase\.co$/, ".functions.supabase.co");
      syncUrl = `${projectUrl.protocol}//${functionsHost}/brokerage-sync/sync`;
    } else {
      const base = `${projectUrl.protocol}//${host}`.replace(/\/?$/, "");
      syncUrl = `${base}/functions/v1/brokerage-sync/sync`;
    }
  }

  const response = await fetch(syncUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ connectionId }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `Failed to trigger brokerage sync for ${connectionId}: ${response.status} - ${body}`,
    );
    throw new HttpError(
      `Failed to trigger brokerage sync: ${response.status}`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }
};

const verifyCronSecret = (req: Request) => {
  const expectedSecret = getEnv("BROKERAGE_CRON_SECRET", { required: false });
  if (!expectedSecret) {
    return;
  }

  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : undefined;

  if (token !== expectedSecret) {
    throw new HttpError("Unauthorized", 401);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    verifyCronSecret(req);
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const requestedLimit = Number.parseInt(limitParam ?? "", 10);
    const batchSize = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, DEFAULT_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    const { data: connections, error } = await supabase
      .from("brokerage_connections")
      .select(
        "id, user_id, status, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, metadata, last_synced_at",
      )
      .eq("status", "active")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (error) {
      console.error("Failed to load brokerage connections", error);
      throw new HttpError("Unable to load brokerage connections", 500, error);
    }

    const staggerMs = Math.max(DEFAULT_DELAY_MS, 0);

    const summary = {
      connections: connections?.length ?? 0,
      refreshed: 0,
      synced: 0,
      failures: [] as Array<{ id: string; error: string }>,
    };

    for (const connection of connections ?? []) {
      try {
        const existingAccessToken = decodeToken(connection.access_token_encrypted);
        const needsRefresh = shouldRefreshToken(connection.access_token_expires_at)
          || !existingAccessToken;

        if (needsRefresh) {
          const refreshResult = await refreshAccessToken(supabase, connection);
          if (refreshResult.refreshed) {
            summary.refreshed += 1;
          }
        }

        await triggerSync(connection.id);
        summary.synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        summary.failures.push({ id: connection.id, error: message });
      }

      if (staggerMs > 0) {
        await delay(staggerMs);
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("brokerage-refresh handler error", error);
    if (error instanceof HttpError) {
      const body: JsonRecord = { error: error.message };
      if (error.details) {
        body.details = error.details;
      }

      return new Response(JSON.stringify(body), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) {
  serve(handler);
}

export default handler;
