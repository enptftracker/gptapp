import { describe, expect, it } from 'bun:test';

import { resolveSupabaseFunctionUrl } from './env';

describe('resolveSupabaseFunctionUrl', () => {
  const functionName = 'market-data';

  it('appends the function segment when missing', () => {
    const result = resolveSupabaseFunctionUrl(functionName, 'https://example.supabase.co/functions/v1');
    const url = new URL(result);

    expect(url.pathname).toBe('/functions/v1/market-data');
  });

  it('preserves a base URL that already includes the function', () => {
    const result = resolveSupabaseFunctionUrl(
      functionName,
      'https://example.supabase.co/functions/v1/market-data'
    );
    const url = new URL(result);

    expect(url.pathname).toBe('/functions/v1/market-data');
  });

  it('normalizes trailing slashes even when a query string is present', () => {
    const result = resolveSupabaseFunctionUrl(
      functionName,
      'https://example.supabase.co/functions/v1/market-data/?skipAuth=true'
    );
    const url = new URL(result);

    expect(url.pathname).toBe('/functions/v1/market-data');
    expect(url.search).toBe('?skipAuth=true');
  });

  it('removes trailing slashes when the base already ends with the function segment', () => {
    const result = resolveSupabaseFunctionUrl(
      functionName,
      'https://example.supabase.co/functions/v1/market-data/'
    );
    const url = new URL(result);

    expect(url.pathname).toBe('/functions/v1/market-data');
  });
});
