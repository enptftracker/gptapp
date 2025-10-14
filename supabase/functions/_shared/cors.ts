const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gptapp-khaki.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const getCorsHeaders = () => corsHeaders;

export { corsHeaders };
