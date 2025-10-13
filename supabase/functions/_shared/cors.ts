const defaultOrigins = [
  'https://gptapp-khaki.vercel.app',
  'https://*.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]

const parseOrigins = (value?: string | null): string[] =>
  (value ?? '')
    .split(/[\s,]+/)
    .map(origin => origin.trim())
    .filter(Boolean)

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/g, '')

const matchesWildcard = (origin: string, pattern: string) => {
  const normalizedOrigin = stripTrailingSlashes(origin)
  const normalizedPattern = stripTrailingSlashes(pattern)

  if (normalizedPattern === '*') {
    return true
  }

  if (!normalizedPattern.includes('*')) {
    return normalizedOrigin.toLowerCase() === normalizedPattern.toLowerCase()
  }

  const escaped = normalizedPattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')

  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(normalizedOrigin)
}

const configuredOrigins = parseOrigins(Deno.env.get('APP_ORIGIN'))

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]))

const FORCED_ORIGIN = 'https://gptapp-khaki.vercel.app'

const resolveOrigin = (originHeader?: string | null) => {
  const origin = originHeader ?? undefined

  if (!origin) {
    return FORCED_ORIGIN
  }

  const allowAnyOrigin = allowedOrigins.includes('*')

  if (allowAnyOrigin) {
    return FORCED_ORIGIN
  }

  const isAllowed = allowedOrigins.some(allowed => matchesWildcard(origin, allowed))

  if (isAllowed) {
    return FORCED_ORIGIN
  }

  return FORCED_ORIGIN
}

export const getCorsHeaders = (requestOrOrigin?: Request | string | null) => {
  const originHeader = typeof requestOrOrigin === 'string'
    ? requestOrOrigin
    : requestOrOrigin instanceof Request
      ? requestOrOrigin.headers.get('origin') ?? requestOrOrigin.headers.get('Origin') ?? undefined
      : undefined

  const resolvedOrigin = resolveOrigin(originHeader ?? undefined)

  const baseHeaders = {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }

  if (resolvedOrigin !== '*') {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Credentials': 'true'
    }
  }

  return baseHeaders
}

export const corsHeaders = getCorsHeaders()
