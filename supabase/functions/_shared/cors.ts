const defaultOrigins = [
  'https://b384bbd0-1d3b-4c79-b219-101a8a434a65.lovable.app',
  'https://gptapp-khaki.vercel.app',
  'https://*.vercel.app',
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

const matchesWildcard = (origin: string, pattern: string) => {
  if (pattern === '*') {
    return true
  }

  if (!pattern.includes('*')) {
    return origin.toLowerCase() === pattern.toLowerCase()
  }

  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')

  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(origin)
}

const configuredOrigins = parseOrigins(Deno.env.get('APP_ORIGIN'))

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]))

const resolveOrigin = (originHeader?: string | null) => {
  const origin = originHeader ?? undefined

  const allowAnyOrigin = allowedOrigins.includes('*')
  const hasExplicitConfig = configuredOrigins.length > 0

  if (!origin) {
    if (hasExplicitConfig) {
      return configuredOrigins.find(item => item !== '*') ?? configuredOrigins[0] ?? '*'
    }
    return '*'
  }

  if (allowAnyOrigin) {
    return origin
  }

  const isAllowed = allowedOrigins.some(allowed => matchesWildcard(origin, allowed))

  if (isAllowed) {
    return origin
  }

  if (hasExplicitConfig) {
    return configuredOrigins.find(item => item !== '*') ?? configuredOrigins[0] ?? '*'
  }

  return '*'
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
