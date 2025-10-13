const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://majfmrisrwhdsmrvyfzm.supabase.co';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hamZtcmlzcndoZHNtcnZ5Znp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNzc1MDAsImV4cCI6MjA3MjY1MzUwMH0.UqgJRN0-C5Quek9jxbyBL4vsgZvuQXjonTYRK91w9sU';

const normalizeUrl = (value: string | undefined, fallback: string) => {
  const candidate = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  return candidate.replace(/\/+$/, '');
};

export const SUPABASE_URL = normalizeUrl(import.meta.env.VITE_SUPABASE_URL, url);
export const SUPABASE_ANON_KEY = anon;

const functionUrl = normalizeUrl(import.meta.env.VITE_SUPABASE_FUNCTION_URL, `${SUPABASE_URL}/functions/v1`);
export const SUPABASE_FUNCTION_URL = functionUrl;

const trimSlashes = (value: string) => value.replace(/\/+$/, '').replace(/^\/+/, '');

export const resolveSupabaseFunctionUrl = (
  functionName: string,
  baseUrl: string = SUPABASE_FUNCTION_URL
): string => {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    throw new Error('Supabase function URL is not configured.');
  }

  const normalizedName = trimSlashes(functionName);
  if (!normalizedName) {
    throw new Error('Function name is required to resolve Supabase function URL.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);

    if (segments[segments.length - 1] !== normalizedName) {
      segments.push(normalizedName);
    }

    url.pathname = `/${segments.join('/')}`;
    return url.toString();
  }

  const hasLeadingSlash = trimmed.startsWith('/');
  const segments = trimSlashes(trimmed)
    .split('/')
    .filter(Boolean);

  if (segments[segments.length - 1] !== normalizedName) {
    segments.push(normalizedName);
  }

  const path = segments.join('/');
  return hasLeadingSlash ? `/${path}` : path;
};
