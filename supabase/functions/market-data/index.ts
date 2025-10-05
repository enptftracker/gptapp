import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const adminClient = createClient(supabaseUrl, serviceRoleKey)

interface AlphaVantageQuote {
  '01. symbol': string
  '02. open': string
  '03. high': string
  '04. low': string
  '05. price': string
  '06. volume': string
  '07. latest trading day': string
  '08. previous close': string
  '09. change': string
  '10. change percent': string
}

interface AlphaVantageResponse {
  'Global Quote': AlphaVantageQuote
  'Error Message'?: string
  'Note'?: string
}

interface YahooQuoteResponse {
  quoteResponse: {
    result: Array<{
      symbol: string
      regularMarketPrice: number
      regularMarketChange: number
      regularMarketChangePercent: number
      regularMarketVolume?: number
      marketCap?: number
    }>
  }
}

async function fetchYahooQuote(symbol: string): Promise<any> {
  console.log(`Fetching Yahoo Finance data for ${symbol}`)
  
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const response = await fetch(url)
    const data = await response.json()
    
    if (!data.chart?.result?.[0]) {
      throw new Error(`No Yahoo Finance data for ${symbol}`)
    }
    
    const result = data.chart.result[0]
    const meta = result.meta
    const quote = result.indicators?.quote?.[0]
    
    if (!meta || !quote) {
      throw new Error(`Invalid Yahoo Finance data for ${symbol}`)
    }
    
    const currentPrice = meta.regularMarketPrice || meta.previousClose
    const previousClose = meta.previousClose
    const change = currentPrice - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    
    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      volume: meta.regularMarketVolume,
      lastUpdated: new Date()
    }
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error)
    // Return a placeholder with 0 values if both APIs fail
    return {
      symbol: symbol.toUpperCase(),
      price: 0,
      change: 0,
      changePercent: 0,
      lastUpdated: new Date()
    }
  }
}

async function fetchAlphaVantageQuote(symbol: string): Promise<any> {
  const apiKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
  if (!apiKey) {
    throw new Error('AlphaVantage API key not configured')
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  
  console.log(`Fetching data for ${symbol}`)
  
  const response = await fetch(url)
  const data: AlphaVantageResponse = await response.json()
  
  if (data['Error Message']) {
    console.error(`AlphaVantage error for ${symbol}:`, data['Error Message'])
    throw new Error(`AlphaVantage error: ${data['Error Message']}`)
  }
  
  if (data['Note']) {
    console.error(`AlphaVantage rate limit for ${symbol}:`, data['Note'])
    // For rate limiting, try Yahoo Finance as backup
    return await fetchYahooQuote(symbol)
  }
  
  if (!data['Global Quote']) {
    console.error(`No AlphaVantage data for ${symbol}, trying Yahoo Finance`)
    return await fetchYahooQuote(symbol)
  }
  
  const quote = data['Global Quote']
  
  return {
    symbol: quote['01. symbol'],
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['09. change']),
    changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    volume: parseInt(quote['06. volume']),
    lastUpdated: new Date()
  }
}

async function fetchHistoricalData(symbol: string, client: SupabaseClient): Promise<void> {
  const apiKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
  if (!apiKey) {
    throw new Error('AlphaVantage API key not configured')
  }

  // Fetch 5 years of daily data
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${apiKey}`
  
  console.log(`Fetching historical data for ${symbol}`)
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (data['Error Message']) {
    throw new Error(`AlphaVantage error: ${data['Error Message']}`)
  }
  
  if (data['Note']) {
    throw new Error(`AlphaVantage rate limit: ${data['Note']}`)
  }
  
  const timeSeries = data['Time Series (Daily)']
  if (!timeSeries) {
    throw new Error(`No historical data returned for symbol ${symbol}`)
  }

  // Get symbol_id from database
  const { data: symbolData, error: symbolError } = await client
    .from('symbols')
    .select('id')
    .eq('ticker', symbol.toUpperCase())
    .single()

  if (symbolError || !symbolData) {
    console.log(`Symbol ${symbol} not found in database, skipping historical data`)
    return
  }

  // Prepare historical price data for insertion
  const historicalPrices = []
  const dates = Object.keys(timeSeries).slice(0, 1825) // 5 years of data

  for (const date of dates) {
    const dayData = timeSeries[date]
    historicalPrices.push({
      symbol_id: symbolData.id,
      price: parseFloat(dayData['4. close']),
      price_currency: 'USD',
      asof: new Date(date + 'T00:00:00Z').toISOString()
    })
  }

  // Insert historical data in batches
  const batchSize = 100
  for (let i = 0; i < historicalPrices.length; i += batchSize) {
    const batch = historicalPrices.slice(i, i + batchSize)
    const { error } = await client
      .from('price_cache')
      .upsert(batch, { onConflict: 'symbol_id,asof' })
    
    if (error) {
      console.error(`Error inserting batch ${i}-${i + batchSize}:`, error)
    }
  }

  console.log(`Inserted ${historicalPrices.length} historical prices for ${symbol}`)
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const unauthorizedResponse = () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  try {
    const authHeader = req.headers.get('Authorization')?.trim() ?? ''

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return unauthorizedResponse()
    }

    if (!anonKey) {
      console.error('SUPABASE_ANON_KEY is not configured')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return unauthorizedResponse()
    }

    const { action, symbol, symbols } = await req.json()

    if (typeof action !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'quote') {
      if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const normalizedSymbol = symbol.trim().toUpperCase()

      let marketData
      try {
        marketData = await fetchAlphaVantageQuote(normalizedSymbol)
      } catch (error) {
        console.error(`AlphaVantage failed for ${normalizedSymbol}, trying Yahoo:`, error)
        marketData = await fetchYahooQuote(normalizedSymbol)
      }

      const { data: symbolData } = await adminClient
        .from('symbols')
        .select('id')
        .eq('ticker', normalizedSymbol)
        .single()

      if (symbolData) {
        const { error } = await adminClient
          .from('price_cache')
          .upsert({
            symbol_id: symbolData.id,
            price: marketData.price,
            price_currency: 'USD',
            change_24h: marketData.change,
            change_percent_24h: marketData.changePercent,
            asof: new Date().toISOString()
          }, { onConflict: 'symbol_id' })

        if (error) {
          console.error('Error updating price cache:', error)
        }
      }

      return new Response(JSON.stringify(marketData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'batch_update') {
      if (!Array.isArray(symbols)) {
        return new Response(JSON.stringify({ error: 'symbols must be an array' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (symbols.length === 0) {
        return new Response(JSON.stringify({ error: 'At least one symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (symbols.length > 20) {
        return new Response(JSON.stringify({ error: 'Too many symbols requested' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const sanitizedSymbols = symbols
        .filter((item) =>
          item && typeof item === 'object' && typeof item.id === 'string' && typeof item.ticker === 'string'
        )
        .map((item) => ({
          id: item.id,
          ticker: item.ticker.trim().toUpperCase()
        }))

      if (sanitizedSymbols.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid symbols provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const results = []

      for (let index = 0; index < sanitizedSymbols.length; index++) {
        const symbolItem = sanitizedSymbols[index]
        try {
          const marketData = await fetchAlphaVantageQuote(symbolItem.ticker)

          const { error } = await adminClient
            .from('price_cache')
            .upsert({
              symbol_id: symbolItem.id,
              price: marketData.price,
              price_currency: 'USD',
              change_24h: marketData.change,
              change_percent_24h: marketData.changePercent,
              asof: new Date().toISOString()
            }, { onConflict: 'symbol_id' })

          if (error) {
            console.error(`Error updating price cache for ${symbolItem.ticker}:`, error)
          }

          results.push({ symbol: symbolItem.ticker, success: true, data: marketData })

          if (index < sanitizedSymbols.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 12000))
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbolItem.ticker}:`, error)
          try {
            const yahooData = await fetchYahooQuote(symbolItem.ticker)

            const { error: updateError } = await adminClient
              .from('price_cache')
              .upsert({
                symbol_id: symbolItem.id,
                price: yahooData.price,
                price_currency: 'USD',
                change_24h: yahooData.change,
                change_percent_24h: yahooData.changePercent,
                asof: new Date().toISOString()
              }, { onConflict: 'symbol_id' })

            if (updateError) {
              console.error(`Error updating price cache for ${symbolItem.ticker} (Yahoo):`, updateError)
            }

            results.push({ symbol: symbolItem.ticker, success: true, data: yahooData, source: 'yahoo' })
          } catch (yahooError) {
            const fallbackError = yahooError instanceof Error ? yahooError.message : String(yahooError)
            results.push({ symbol: symbolItem.ticker, success: false, error: fallbackError })
          }
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'historical') {
      const majorIndices = ['SPY', 'QQQ', 'IWM']

      for (const index of majorIndices) {
        try {
          await fetchHistoricalData(index, adminClient)
          await new Promise(resolve => setTimeout(resolve, 12000))
        } catch (error) {
          console.error(`Error fetching historical data for ${index}:`, error)
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Historical data update completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Market data function error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
