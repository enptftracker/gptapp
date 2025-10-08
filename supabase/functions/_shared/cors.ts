const allowedOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://b384bbd0-1d3b-4c79-b219-101a8a434a65.lovable.app'

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
