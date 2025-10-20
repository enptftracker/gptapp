import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { getCorsHeaders } from "../_shared/cors.ts";

type JsonRecord = Record<string, unknown>;

type BrokerAccountResponse = {
  id?: string;
  name?: string | null;
  type?: string | null;
  currency?: string | null;
  [key: string]: unknown;
};

type BrokerPositionResponse = {
  id?: string;
  symbol?: string | null;
  quantity?: number | string | null;
  cost_basis?: number | string | null;
  [key: string]: unknown;
};

type BrokerAccountsPayload = BrokerAccountResponse[] | { accounts?: BrokerAccountResponse[] };

type BrokerPositionsPayload = BrokerPositionResponse[] | { positions?: BrokerPositionResponse[] };

type BrokerageConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  access_token_encrypted: string | Uint8Array | null;
  refresh_token_encrypted: string | Uint8Array | null;
  access_token_expires_at: string | null;
  metadata: JsonRecord;
  last_synced_at: string | null;
};

type BrokerageAccountRow = {
  id: string;
  connection_id: string;
  external_id: string | null;
  name: string | null;
  account_type: string | null;
  currency: string | null;
  metadata: JsonRecord;
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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getEnv = (key: string, { required = true }: { required?: boolean } = {}): string | undefined => {
  const value = Deno.env.get(key)?.trim();
  if (!value && required) {
    throw new HttpError(`Missing required environment variable: ${key}`, 500);
  }

  return value;
};

const brokerConfig = {
  authorizeUrl: () => getEnv("BROKER_OAUTH_AUTHORIZE_URL", { required: false }),
  tokenUrl: () => getEnv("BROKER_OAUTH_TOKEN_URL", { required: false }),
  apiBaseUrl: () => getEnv("BROKER_API_BASE_URL"),
  clientId: () => getEnv("BROKER_CLIENT_ID", { required: false }),
  clientSecret: () => getEnv("BROKER_CLIENT_SECRET", { required: false }) ?? "",
  defaultScope: () => getEnv("BROKER_DEFAULT_SCOPE", { required: false }) ?? "accounts positions",
  defaultRedirectUri: () => getEnv("BROKER_REDIRECT_URI", { required: false }),
};

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  try {
    supabaseClient = createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false },
    });
    return supabaseClient;
  } catch (error) {
    console.error("Failed to initialize Supabase client", error);
    throw new HttpError("Supabase client initialization failed", 500);
  }
};

const verifyServiceRoleCaller = (req: Request) => {
  const expectedKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : undefined;

  if (token !== expectedKey) {
    throw new HttpError("Unauthorized", 401);
  }
};

const normalizePath = (url: URL): string => {
  const path = url.pathname.replace(/\/+$/, "");
  const withoutBase = path.replace(/^\/brokerage-sync/, "");
  return withoutBase || "/";
};

const readJson = async <T>(req: Request): Promise<T> => {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new HttpError("Request body must be JSON", 415);
    }

    return await req.json() as T;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error("Failed to parse JSON body", error);
    throw new HttpError("Invalid JSON body", 400);
  }
};

const toIsoTimestamp = (expiresInSeconds?: number): string | null => {
  if (!expiresInSeconds || Number.isNaN(expiresInSeconds)) {
    return null;
  }

  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);
  return expiryDate.toISOString();
};

const encodeToken = (token: string | undefined | null): Uint8Array | null => {
  if (!token) {
    return null;
  }

  return textEncoder.encode(token);
};

const decodeToken = (value: string | Uint8Array | null | undefined): string | null => {
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

const normalizeTicker = (symbol: string | null | undefined): string => {
  return (symbol ?? "").trim().toUpperCase();
};

const fetchConnection = async (supabase: SupabaseClient, connectionId: string): Promise<BrokerageConnectionRow> => {
  const { data, error } = await supabase
    .from("brokerage_connections")
    .select("id, user_id, provider, status, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, metadata, last_synced_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load brokerage connection", error);
    throw new HttpError("Unable to load brokerage connection", 500, error);
  }

  if (!data) {
    throw new HttpError("Brokerage connection not found", 404);
  }

  return data as BrokerageConnectionRow;
};

const updateConnection = async (
  supabase: SupabaseClient,
  connectionId: string,
  payload: Partial<BrokerageConnectionRow>,
) => {
  const { error } = await supabase
    .from("brokerage_connections")
    .update(payload)
    .eq("id", connectionId);

  if (error) {
    console.error("Failed to update brokerage connection", error);
    throw new HttpError("Unable to update brokerage connection", 500, error);
  }
};

const ensureAccounts = async (
  supabase: SupabaseClient,
  connectionId: string,
  accounts: BrokerAccountResponse[],
): Promise<Map<string, BrokerageAccountRow>> => {
  if (!accounts.length) {
    return new Map();
  }

  const { data: existing, error } = await supabase
    .from("brokerage_accounts")
    .select("id, connection_id, external_id, name, account_type, currency, metadata")
    .eq("connection_id", connectionId);

  if (error) {
    console.error("Failed to load brokerage accounts", error);
    throw new HttpError("Unable to load brokerage accounts", 500, error);
  }

  const byExternalId = new Map<string, BrokerageAccountRow>();
  for (const row of existing ?? []) {
    if (row.external_id) {
      byExternalId.set(row.external_id, row as BrokerageAccountRow);
    }
  }

  const inserts: JsonRecord[] = [];
  const updates: { id: string; payload: JsonRecord }[] = [];

  for (const account of accounts) {
    const externalId = typeof account.id === "string" ? account.id : undefined;
    if (!externalId) {
      console.warn("Skipping broker account without id", account);
      continue;
    }

    const name = typeof account.name === "string" ? account.name : null;
    const type = typeof account.type === "string" ? account.type : null;
    const currency = typeof account.currency === "string" ? account.currency : null;
    const metadata: JsonRecord = { ...account };

    const existingRow = byExternalId.get(externalId);
    if (existingRow) {
      updates.push({
        id: existingRow.id,
        payload: {
          name,
          account_type: type,
          currency,
          metadata,
          last_synced_at: new Date().toISOString(),
        },
      });
      byExternalId.set(externalId, {
        ...existingRow,
        name,
        account_type: type,
        currency,
        metadata,
      });
    } else {
      inserts.push({
        connection_id: connectionId,
        external_id: externalId,
        name,
        account_type: type,
        currency,
        metadata,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  if (inserts.length) {
    const { data: inserted, error: insertError } = await supabase
      .from("brokerage_accounts")
      .insert(inserts)
      .select("id, connection_id, external_id, name, account_type, currency, metadata");

    if (insertError) {
      console.error("Failed to insert brokerage accounts", insertError);
      throw new HttpError("Unable to insert brokerage accounts", 500, insertError);
    }

    for (const row of inserted ?? []) {
      if (row.external_id) {
        byExternalId.set(row.external_id, row as BrokerageAccountRow);
      }
    }
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("brokerage_accounts")
      .update(update.payload)
      .eq("id", update.id);

    if (updateError) {
      console.error("Failed to update brokerage account", updateError);
      throw new HttpError("Unable to update brokerage accounts", 500, updateError);
    }
  }

  return byExternalId;
};

const ensureSymbols = async (
  supabase: SupabaseClient,
  userId: string,
  tickers: string[],
): Promise<Map<string, string>> => {
  const uniqueTickers = Array.from(new Set(tickers.map((ticker) => normalizeTicker(ticker)))).filter(Boolean);
  if (!uniqueTickers.length) {
    return new Map();
  }

  const { data: existing, error } = await supabase
    .from("symbols")
    .select("id, ticker")
    .eq("owner_id", userId)
    .in("ticker", uniqueTickers);

  if (error) {
    console.error("Failed to load symbols", error);
    throw new HttpError("Unable to load symbols", 500, error);
  }

  const map = new Map<string, string>();
  for (const symbol of existing ?? []) {
    map.set(symbol.ticker, symbol.id);
  }

  const missing = uniqueTickers.filter((ticker) => !map.has(ticker));
  if (missing.length) {
    const payload = missing.map((ticker) => ({
      ticker,
      name: ticker,
      asset_type: "EQUITY",
      quote_currency: "USD",
      owner_id: userId,
    }));

    const { data: created, error: insertError } = await supabase
      .from("symbols")
      .insert(payload)
      .select("id, ticker");

    if (insertError) {
      console.error("Failed to create symbols", insertError);
      throw new HttpError("Unable to create symbols", 500, insertError);
    }

    for (const symbol of created ?? []) {
      map.set(symbol.ticker, symbol.id);
    }
  }

  return map;
};

const upsertPositions = async (
  supabase: SupabaseClient,
  account: BrokerageAccountRow,
  positions: BrokerPositionResponse[],
  symbolMap: Map<string, string>,
) => {
  const { data: existing, error } = await supabase
    .from("brokerage_positions")
    .select("id, symbol")
    .eq("account_id", account.id);

  if (error) {
    console.error("Failed to load brokerage positions", error);
    throw new HttpError("Unable to load brokerage positions", 500, error);
  }

  const existingBySymbol = new Map<string, { id: string }>();
  for (const row of existing ?? []) {
    existingBySymbol.set(row.symbol, { id: row.id });
  }

  const nowIso = new Date().toISOString();
  const inserts: JsonRecord[] = [];
  const updates: { id: string; payload: JsonRecord }[] = [];

  for (const position of positions) {
    const normalizedSymbol = normalizeTicker(position.symbol);
    if (!normalizedSymbol) {
      console.warn("Skipping broker position without symbol", position);
      continue;
    }

    const quantityRaw = typeof position.quantity === "number"
      ? position.quantity
      : typeof position.quantity === "string"
      ? Number.parseFloat(position.quantity)
      : 0;

    if (!Number.isFinite(quantityRaw)) {
      console.warn("Skipping broker position with invalid quantity", position);
      continue;
    }

    const costBasisRaw = typeof position.cost_basis === "number"
      ? position.cost_basis
      : typeof position.cost_basis === "string"
      ? Number.parseFloat(position.cost_basis)
      : undefined;

    const metadata: JsonRecord = {
      ...position,
      local_symbol_id: symbolMap.get(normalizedSymbol) ?? null,
    };

    const payload: JsonRecord = {
      symbol: normalizedSymbol,
      quantity: quantityRaw,
      cost_basis: Number.isFinite(costBasisRaw ?? Number.NaN) ? costBasisRaw ?? null : null,
      metadata,
      last_synced_at: nowIso,
    };

    const existingRow = existingBySymbol.get(normalizedSymbol);
    if (existingRow) {
      updates.push({ id: existingRow.id, payload });
    } else {
      inserts.push({
        account_id: account.id,
        ...payload,
      });
    }
  }

  if (inserts.length) {
    const { error: insertError } = await supabase
      .from("brokerage_positions")
      .insert(inserts);

    if (insertError) {
      console.error("Failed to insert brokerage positions", insertError);
      throw new HttpError("Unable to insert brokerage positions", 500, insertError);
    }
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("brokerage_positions")
      .update(update.payload)
      .eq("id", update.id);

    if (updateError) {
      console.error("Failed to update brokerage position", updateError);
      throw new HttpError("Unable to update brokerage positions", 500, updateError);
    }
  }
};

const fetchBrokerAccounts = async (accessToken: string): Promise<BrokerAccountResponse[]> => {
  const apiBaseUrl = brokerConfig.apiBaseUrl();
  const url = new URL("/accounts", apiBaseUrl);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const upstreamStatus = response.status;
    console.error("Broker accounts request failed", upstreamStatus);
    throw new HttpError(
      `Broker accounts request failed with status ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload: BrokerAccountsPayload = await response.json();
  const accounts = Array.isArray(payload) ? payload : payload.accounts;

  if (!Array.isArray(accounts)) {
    console.error("Broker accounts response is invalid", payload);
    throw new HttpError("Broker accounts response is invalid", 502, payload);
  }

  return accounts;
};

const fetchBrokerPositions = async (
  accessToken: string,
  accountId: string,
): Promise<BrokerPositionResponse[]> => {
  const apiBaseUrl = brokerConfig.apiBaseUrl();
  const url = new URL(`/accounts/${accountId}/positions`, apiBaseUrl);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const upstreamStatus = response.status;
    console.error("Broker positions request failed", upstreamStatus, accountId);
    throw new HttpError(
      `Broker positions request failed with status ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload: BrokerPositionsPayload = await response.json();
  const positions = Array.isArray(payload) ? payload : payload.positions;

  if (!Array.isArray(positions)) {
    console.error("Broker positions response is invalid", payload);
    throw new HttpError("Broker positions response is invalid", 502, payload);
  }

  return positions;
};

const handleInitiateOAuth = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  const body = await readJson<{ connectionId?: string; redirectUri?: string; scope?: string }>(req);

  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new HttpError("connectionId is required", 400);
  }

  const redirectUri = body.redirectUri?.trim() || brokerConfig.defaultRedirectUri();
  if (!redirectUri) {
    throw new HttpError("redirectUri is required", 400);
  }

  const scope = body.scope?.trim() || brokerConfig.defaultScope();

  const connection = await fetchConnection(supabase, connectionId);
  if (connection.provider === "trading212") {
    throw new HttpError("Trading212 connections require direct token submission", 501);
  }

  const authorizeUrlValue = brokerConfig.authorizeUrl();
  const clientId = brokerConfig.clientId();
  if (!authorizeUrlValue || !clientId) {
    throw new HttpError("Broker OAuth configuration is incomplete", 500);
  }
  const state = crypto.randomUUID();

  const authorizeUrl = new URL(authorizeUrlValue);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  const metadata = { ...(connection.metadata ?? {}), oauth_state: state, oauth_redirect_uri: redirectUri };
  await updateConnection(supabase, connectionId, { metadata });

  const responseBody = {
    authorizationUrl: authorizeUrl.toString(),
    state,
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const handleExchangeTokens = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  const body = await readJson<{ connectionId?: string; code?: string; state?: string; redirectUri?: string }>(req);

  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new HttpError("connectionId is required", 400);
  }

  const code = body.code?.trim();
  if (!code) {
    throw new HttpError("authorization code is required", 400);
  }

  const redirectUri = body.redirectUri?.trim() || brokerConfig.defaultRedirectUri();
  if (!redirectUri) {
    throw new HttpError("redirectUri is required", 400);
  }

  const connection = await fetchConnection(supabase, connectionId);
  if (connection.provider === "trading212") {
    throw new HttpError("Trading212 connections require direct token submission", 501);
  }
  const expectedState = typeof connection.metadata?.oauth_state === "string"
    ? connection.metadata.oauth_state
    : undefined;

  if (expectedState && body.state?.trim() && expectedState !== body.state.trim()) {
    throw new HttpError("OAuth state mismatch", 400);
  }

  const tokenUrl = brokerConfig.tokenUrl();
  const clientId = brokerConfig.clientId();
  if (!tokenUrl || !clientId) {
    throw new HttpError("Broker OAuth configuration is incomplete", 500);
  }
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("client_id", clientId);
  if (brokerConfig.clientSecret()) {
    params.set("client_secret", brokerConfig.clientSecret());
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
    console.error("Broker token exchange failed", upstreamStatus);
    throw new HttpError(
      `Broker token exchange failed with status ${upstreamStatus}`,
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502,
    );
  }

  const payload = await response.json();

  const accessToken = typeof payload.access_token === "string" ? payload.access_token : undefined;
  if (!accessToken) {
    console.error("Broker token response missing access_token", payload);
    throw new HttpError("Broker token response missing access_token", 502, payload);
  }

  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : undefined;
  const expiresInRaw = typeof payload.expires_in === "number"
    ? payload.expires_in
    : typeof payload.expires_in === "string"
    ? Number.parseInt(payload.expires_in, 10)
    : undefined;
  const accessTokenExpiresAt = toIsoTimestamp(Number.isFinite(expiresInRaw ?? Number.NaN) ? expiresInRaw : undefined);

  const metadata = { ...(connection.metadata ?? {}) };
  delete metadata.oauth_state;
  delete metadata.oauth_redirect_uri;

  await updateConnection(supabase, connectionId, {
    status: "active",
    access_token_encrypted: encodeToken(accessToken),
    refresh_token_encrypted: encodeToken(refreshToken),
    access_token_expires_at: accessTokenExpiresAt,
    metadata,
  });

  return new Response(JSON.stringify({
    status: "active",
    accessTokenExpiresAt,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const handleSubmitToken = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  verifyServiceRoleCaller(req);
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  const body = await readJson<{ connectionId?: string; apiToken?: string }>(req);

  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new HttpError("connectionId is required", 400);
  }

  const apiToken = body.apiToken?.trim();
  if (!apiToken) {
    throw new HttpError("apiToken is required", 400);
  }

  const connection = await fetchConnection(supabase, connectionId);
  if (connection.provider !== "trading212") {
    throw new HttpError("Token submissions are only supported for Trading212 connections", 400);
  }

  const encodedToken = encodeToken(btoa(apiToken));
  if (!encodedToken) {
    throw new HttpError("apiToken is invalid", 400);
  }

  const metadata = { ...(connection.metadata ?? {}) };
  delete metadata.oauth_state;
  delete metadata.oauth_redirect_uri;

  await updateConnection(supabase, connectionId, {
    status: "active",
    access_token_encrypted: encodedToken,
    refresh_token_encrypted: null,
    access_token_expires_at: null,
    metadata,
  });

  return new Response(JSON.stringify({ status: "active" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const handleSync = async (req: Request, supabase: SupabaseClient): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  const body = await readJson<{ connectionId?: string }>(req);

  const connectionId = body.connectionId?.trim();
  if (!connectionId) {
    throw new HttpError("connectionId is required", 400);
  }

  const connection = await fetchConnection(supabase, connectionId);
  const accessToken = decodeToken(connection.access_token_encrypted);
  if (!accessToken) {
    throw new HttpError("Connection does not have an access token", 400);
  }

  console.log(`Syncing brokerage accounts for connection ${connectionId}`);
  const accounts = await fetchBrokerAccounts(accessToken);

  const accountMap = await ensureAccounts(supabase, connectionId, accounts);

  const allTickers: string[] = [];
  const accountPositions: Array<{ account: BrokerageAccountRow; positions: BrokerPositionResponse[] }> = [];

  for (const account of accounts) {
    const externalId = typeof account.id === "string" ? account.id : undefined;
    if (!externalId) {
      continue;
    }

    const dbAccount = accountMap.get(externalId);
    if (!dbAccount) {
      console.warn("No database account found for external id", externalId);
      continue;
    }

    const positions = await fetchBrokerPositions(accessToken, externalId);
    accountPositions.push({ account: dbAccount, positions });

    for (const position of positions) {
      const ticker = normalizeTicker(position.symbol);
      if (ticker) {
        allTickers.push(ticker);
      }
    }
  }

  const symbolMap = await ensureSymbols(supabase, connection.user_id, allTickers);

  let totalPositions = 0;
  for (const { account, positions } of accountPositions) {
    await upsertPositions(supabase, account, positions, symbolMap);
    totalPositions += positions.length;
  }

  await updateConnection(supabase, connectionId, { last_synced_at: new Date().toISOString() });

  return new Response(JSON.stringify({
    accounts: accountMap.size,
    positions: totalPositions,
    status: "synced",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const router = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  try {
    const path = normalizePath(new URL(req.url));

    if (req.method === "POST" && path === "/oauth/initiate") {
      return await handleInitiateOAuth(req, supabase);
    }

    if (req.method === "POST" && path === "/oauth/token") {
      return await handleExchangeTokens(req, supabase);
    }

    if (req.method === "POST" && path === "/token/submit") {
      return await handleSubmitToken(req, supabase);
    }

    if (req.method === "POST" && path === "/sync") {
      return await handleSync(req, supabase);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("brokerage-sync handler error", error);
    if (error instanceof HttpError) {
      const body: JsonRecord = { error: error.message };
      if (error.details) {
        body.details = error.details;
      }

      return new Response(JSON.stringify(body), {
        status: error.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

if (import.meta.main) {
  serve(router);
}
