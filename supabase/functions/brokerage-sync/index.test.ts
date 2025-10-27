import {
  decodeToken,
  encodeToken,
  extractTrading212UsdAmount,
  getBrokerAuthorizationHeader,
  ensureConnectionOwnership,
  HttpError,
  mapTrading212Account,
  mapTrading212Position,
} from "./index.ts";
import {
  assertStrictEquals,
  assertNotEquals,
  assertThrows,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

Deno.test("mapTrading212Account normalizes base fields and metadata", () => {
  const account = {
    accountId: "INVEST123",
    accountType: "INVEST",
    accountAlias: "Main Account",
    baseCurrency: "GBP",
    cash: { available: { value: 1000, currencyCode: "GBP" } },
  };

  const mapped = mapTrading212Account(account);

  if (!mapped) {
    throw new Error("Expected mapped account");
  }

  assertStrictEquals(mapped.id, "INVEST123");
  assertStrictEquals(mapped.name, "Main Account");
  assertStrictEquals(mapped.type, "INVEST");
  assertStrictEquals(mapped.currency, "GBP");
  assertStrictEquals(mapped.provider, "trading212");
  assertStrictEquals(mapped.baseCurrency, "GBP");
  assertStrictEquals(mapped.instrumentType, "INVEST");
});

Deno.test("extractTrading212UsdAmount finds USD via conversion fields", () => {
  const money = {
    value: 100,
    currencyCode: "GBP",
    converted: {
      value: 125,
      currencyCode: "USD",
    },
  };

  assertStrictEquals(extractTrading212UsdAmount(money), 125);
});

Deno.test("mapTrading212Position normalizes USD average price when already USD", () => {
  const position = {
    ticker: "AAPL",
    quantity: "2",
    instrumentType: "EQUITY",
    currencyCode: "USD",
    averagePrice: {
      value: 195.55,
      currencyCode: "USD",
    },
    totalValue: {
      value: 391.1,
      currencyCode: "USD",
    },
  };

  const mapped = mapTrading212Position(position, "INVEST123");

  if (!mapped) {
    throw new Error("Expected mapped position");
  }

  assertStrictEquals(mapped.symbol, "AAPL");
  assertStrictEquals(mapped.quantity, 2);
  assertStrictEquals(mapped.cost_basis, 195.55);
  assertStrictEquals(mapped.instrumentType, "EQUITY");
  assertStrictEquals(mapped.currency, "USD");
  assertStrictEquals(mapped.provider, "trading212");
  assertStrictEquals(mapped.accountId, "INVEST123");
  assertStrictEquals(mapped.totalValueUsd, 391.1);
});

Deno.test("mapTrading212Position uses converted USD values when available", () => {
  const position = {
    ticker: "VOD",
    quantity: 10,
    instrumentType: "EQUITY",
    currencyCode: "GBP",
    averagePrice: {
      value: 98.23,
      currencyCode: "GBP",
      converted: {
        value: 120.12,
        currencyCode: "USD",
      },
    },
    totalValue: {
      value: 982.3,
      currencyCode: "GBP",
      converted: {
        value: 1201.2,
        currencyCode: "USD",
      },
    },
  };

  const mapped = mapTrading212Position(position, "INVEST456");

  if (!mapped) {
    throw new Error("Expected mapped position");
  }

  assertStrictEquals(mapped.symbol, "VOD");
  assertStrictEquals(mapped.quantity, 10);
  assertStrictEquals(mapped.cost_basis, 120.12);
  assertStrictEquals(mapped.totalValueUsd, 1201.2);
  assertStrictEquals(mapped.currency, "GBP");
  assertStrictEquals(mapped.accountId, "INVEST456");
  assertNotEquals(mapped.cost_basis, position.averagePrice?.value);
});

Deno.test("encode/decode preserves Trading212 submission tokens", () => {
  const sampleToken = "trading212_token_with_specials+/=";

  const storedValue = encodeToken(sampleToken);
  if (!storedValue) {
    throw new Error("Expected encoded token");
  }

  const decoded = decodeToken(storedValue);
  assertStrictEquals(decoded, sampleToken);
});

Deno.test("getBrokerAuthorizationHeader uses raw token for Trading212", () => {
  const header = getBrokerAuthorizationHeader("trading212", "token-123");
  assertStrictEquals(header, "token-123");
});

Deno.test("getBrokerAuthorizationHeader prefixes Bearer for OAuth brokers", () => {
  const header = getBrokerAuthorizationHeader("other-broker", "token-abc");
  assertStrictEquals(header, "Bearer token-abc");
});

Deno.test("ensureConnectionOwnership allows matching users", () => {
  const connection = {
    id: "connection-1",
    user_id: "user-123",
    provider: "trading212",
    status: "active",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    access_token_expires_at: null,
    metadata: {},
    last_synced_at: null,
  };

  ensureConnectionOwnership(connection, "user-123");
});

Deno.test("ensureConnectionOwnership throws 403 for mismatched users", () => {
  const connection = {
    id: "connection-1",
    user_id: "user-abc",
    provider: "trading212",
    status: "active",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    access_token_expires_at: null,
    metadata: {},
    last_synced_at: null,
  };

  const error = assertThrows(
    () => ensureConnectionOwnership(connection, "user-123"),
    HttpError,
    "You do not have access to this connection",
  );

  assertStrictEquals(error.status, 403);
});
