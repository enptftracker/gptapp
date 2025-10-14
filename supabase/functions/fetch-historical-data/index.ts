import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HistoricalRequest {
  ticker: string;
  period: '1D' | '1M' | '3M' | '1Y' | '5Y' | 'MAX';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker, period } = await req.json() as HistoricalRequest;

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Ticker symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY');
    if (!apiKey) {
      console.error('ALPHA_VANTAGE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the function and outputsize based on period
    let functionName = 'TIME_SERIES_DAILY';
    let outputsize = 'compact'; // last 100 data points
    
    if (period === '1D') {
      functionName = 'TIME_SERIES_INTRADAY';
    } else if (period === '5Y' || period === 'MAX') {
      outputsize = 'full'; // full historical data (up to 20 years)
    }

    let url = '';
    if (period === '1D') {
      url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${ticker}&interval=5min&apikey=${apiKey}`;
    } else {
      url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${ticker}&outputsize=${outputsize}&apikey=${apiKey}`;
    }

    console.log(`Fetching historical data for ${ticker} (${period})`);
    const response = await fetch(url);
    const data = await response.json();

    // Handle API errors
    if (data['Error Message']) {
      console.error('Alpha Vantage error:', data['Error Message']);
      return new Response(
        JSON.stringify({ error: 'Stock not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data['Note']) {
      console.error('API rate limit:', data['Note']);
      return new Response(
        JSON.stringify({ error: 'API rate limit reached. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract time series data
    const timeSeriesKey = period === '1D' 
      ? 'Time Series (5min)' 
      : 'Time Series (Daily)';
    
    const timeSeries = data[timeSeriesKey];
    
    if (!timeSeries) {
      console.error('No time series data found');
      return new Response(
        JSON.stringify({ error: 'No historical data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert to array format and filter based on period
    const now = new Date();
    const chartData = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        date,
        timestamp: new Date(date).getTime(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume']),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Filter data based on period
    const filteredData = chartData.filter(item => {
      const itemDate = new Date(item.timestamp);
      const diffTime = now.getTime() - itemDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      switch (period) {
        case '1D':
          return diffTime <= 24 * 60 * 60 * 1000;
        case '1M':
          return diffDays <= 30;
        case '3M':
          return diffDays <= 90;
        case '1Y':
          return diffDays <= 365;
        case '5Y':
          return diffDays <= 1825;
        case 'MAX':
          return diffDays <= 3650; // 10 years max
        default:
          return true;
      }
    });

    console.log(`Returning ${filteredData.length} data points for ${ticker} (${period})`);

    return new Response(
      JSON.stringify({ 
        symbol: ticker,
        period,
        data: filteredData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching historical data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch historical data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
