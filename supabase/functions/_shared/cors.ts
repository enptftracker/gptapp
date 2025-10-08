const defaultOrigins = new Set([
  'https://b384bbd0-1d3b-4c79-b219-101a8a434a65.lovable.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
])

const envOrigins = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0)

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]))

const DEFAULT_ORIGIN = allowedOrigins[0] ?? '*'

export function createCorsHeaders(request?: Request) {
  const requestOrigin = request?.headers.get('Origin') ?? ''
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : DEFAULT_ORIGIN

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
}
