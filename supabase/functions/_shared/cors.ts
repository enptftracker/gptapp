// supabase/functions/_shared/cors.ts
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://gptapp-khaki.vercel.app",
  "http://localhost:3000",
  "http://localhost:8080",
]);

const isAllowedOrigin = (origin: string) => {
  if (DEFAULT_ALLOWED_ORIGINS.has(origin) || origin === "*") {
    return true;
  }

  if (origin.startsWith("http://localhost:") || origin.startsWith("https://localhost:")) {
    return true;
  }

  if (origin.endsWith(".vercel.app")) {
    return true;
  }

  return false;
};

export function getCorsHeaders(origin: string | null) {
  // Never throw. Fall back to "*", or reflect allowed origin.
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, sb-access-token, x-supabase-auth, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as const;
}

