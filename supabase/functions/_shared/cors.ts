// supabase/functions/_shared/cors.ts
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://gptapp-khaki.vercel.app",
  "http://localhost:3000",
]);

export function getCorsHeaders(origin: string | null) {
  // Never throw. Fall back to "*", or reflect allowed origin.
  const allowOrigin =
    origin && (DEFAULT_ALLOWED_ORIGINS.has(origin) || origin === "*")
      ? origin
      : "https://gptapp-khaki.vercel.app"; // pick your prod origin, or "*"

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, prefer",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as const;
}

