const DEFAULT_ALLOWED_ORIGIN = 'https://gptapp-khaki.vercel.app';

const ALLOWED_ORIGINS = [
  DEFAULT_ALLOWED_ORIGIN,
  'https://majfmrisrwhdsmrvyfzm.supabase.co',
  'https://majfmrisrwhdsmrvyfzm.supabase.co/functions/v1/fetch-stock-price',
  'http://localhost:3000',
  'http://localhost:5173',
];

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  Vary: 'Origin',
} as const;

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '');

const resolveAllowedOrigin = (origin: string | null): string => {
  if (!origin) {
    return DEFAULT_ALLOWED_ORIGIN;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  const isAllowed = ALLOWED_ORIGINS.some((allowedOrigin) => {
    const normalizedAllowed = normalizeOrigin(allowedOrigin);

    return (
      normalizedAllowed === normalizedOrigin ||
      normalizedAllowed.startsWith(normalizedOrigin) ||
      normalizedOrigin.startsWith(normalizedAllowed)
    );
  });

  return isAllowed ? normalizedOrigin : DEFAULT_ALLOWED_ORIGIN;
};

export const getCorsHeaders = (origin: string | null) => ({
  ...BASE_CORS_HEADERS,
  'Access-Control-Allow-Origin': resolveAllowedOrigin(origin),
});

export const corsHeaders = getCorsHeaders(null);

export const allowedOrigins = [...ALLOWED_ORIGINS];
