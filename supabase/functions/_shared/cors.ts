const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gptapp-khaki.vercel.app','https://majfmrisrwhdsmrvyfzm.supabase.co/functions/v1/fetch-stock-price',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const getCorsHeaders = () => corsHeaders;

export { corsHeaders };
