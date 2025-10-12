const defaultOrigins = [
  'https://b384bbd0-1d3b-4c79-b219-101a8a434a65.lovable.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]

const parseOrigins = (value?: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

const configuredOrigins = parseOrigins(Deno.env.get('APP_ORIGIN'))

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]))

export const getCorsHeaders = (requestOrOrigin?: Request | string | null) => {
  const originHeader = typeof requestOrOrigin === 'string'
    ? requestOrOrigin
    : requestOrOrigin instanceof Request
      ? requestOrOrigin.headers.get('origin') ?? requestOrOrigin.headers.get('Origin') ?? undefined
      : undefined

  const allowAnyOrigin = allowedOrigins.includes('*')
  const hasExplicitConfig = configuredOrigins.length > 0
  const fallbackOrigin = '*'

  if (allowAnyOrigin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  }

  const normalizedOrigin = originHeader?.toLowerCase()
  const isAllowed = normalizedOrigin
    ? allowedOrigins.some(allowed => allowed.toLowerCase() === normalizedOrigin)
    : false

  const resolvedOrigin = hasExplicitConfig
    ? (isAllowed && originHeader ? originHeader : configuredOrigins[0] ?? fallbackOrigin)
    : originHeader ?? fallbackOrigin

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }
}

export const corsHeaders = getCorsHeaders()
