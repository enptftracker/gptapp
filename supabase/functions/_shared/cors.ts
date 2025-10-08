const configuredOrigins = (Deno.env.get('APP_ORIGIN') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

if (configuredOrigins.length === 0) {
  throw new Error('APP_ORIGIN environment variable must be set to at least one allowed origin')
}

const defaultOrigin = configuredOrigins[0]

export function createCorsHeaders(requestOrigin?: string) {
  const normalizedOrigin = requestOrigin?.trim()
  const isAllowed = !normalizedOrigin || configuredOrigins.includes(normalizedOrigin)
  const resolvedOrigin = normalizedOrigin && isAllowed ? normalizedOrigin : defaultOrigin

  return {
    headers: {
      'Access-Control-Allow-Origin': resolvedOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    },
    isAllowed
  }
}

