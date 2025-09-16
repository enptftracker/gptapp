import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

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

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number
        previousClose?: number
        regularMarketVolume?: number
      }
    }>
  }
}

interface MarketQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume?: number
  lastUpdated: string
}

interface BatchUpdateSymbol {
  id: string
  ticker: string
}

type MarketDataRequest =
  | { action: 'quote'; symbol: string }
  | { action: 'batch_update'; symbols: BatchUpdateSymbol[] }
  | { action: 'historical' }

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

async function fetchYahooQuote(symbol: string): Promise<MarketQuote> {
  console.log(`Fetching Yahoo Finance data for ${symbol}`)

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    const response = await fetch(url)
    const data = await response.json() as YahooChartResponse

    const result = data.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) {
      throw new Error(`No Yahoo Finance data for ${symbol}`)
    }

    const currentPrice = meta.regularMarketPrice ?? meta.previousClose ?? 0
    const previousClose = meta.previousClose ?? currentPrice
    const change = currentPrice - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change,
      changePercent,
      volume: meta.regularMarketVolume,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error)
    // Return a placeholder with 0 values if both APIs fail
    return {
      symbol: symbol.toUpperCase(),
      price: 0,
      change: 0,
      changePercent: 0,
      lastUpdated: new Date().toISOString()
    }
  }
}

async function fetchAlphaVantageQuote(symbol: string): Promise<MarketQuote> {
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
    lastUpdated: new Date().toISOString()
  }
}

async function fetchHistoricalData(symbol: string): Promise<void> {
  const apiKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
  if (!apiKey) {
    throw new Error('AlphaVantage API key not configured')
  }

  // Fetch 5 years of daily data
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${apiKey}`
  
  console.log(`Fetching historical data for ${symbol}`)
  
  const response = await fetch(url)
  const data = await response.json() as Record<string, unknown>

  const errorMessage = data['Error Message']
  if (typeof errorMessage === 'string') {
    throw new Error(`AlphaVantage error: ${errorMessage}`)
  }

  const rateLimitNote = data['Note']
  if (typeof rateLimitNote === 'string') {
    throw new Error(`AlphaVantage rate limit: ${rateLimitNote}`)
  }

  const timeSeries = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
  if (!timeSeries) {
    throw new Error(`No historical data returned for symbol ${symbol}`)
  }

  // Get symbol_id from database
  const { data: symbolData, error: symbolError } = await supabase
    .from('symbols')
    .select('id')
    .eq('ticker', symbol.toUpperCase())
    .single()

  if (symbolError || !symbolData) {
    console.log(`Symbol ${symbol} not found in database, skipping historical data`)
    return
  }

  // Prepare historical price data for insertion
  const historicalPrices: Array<{
    symbol_id: string
    price: number
    price_currency: string
    asof: string
  }> = []
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
    const { error } = await supabase
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

  try {
    const body = await req.json() as MarketDataRequest

    if (body.action === 'quote') {
      const { symbol } = body
      let marketData: MarketQuote
      try {
        marketData = await fetchAlphaVantageQuote(symbol)
      } catch (error) {
        console.error(`AlphaVantage failed for ${symbol}, trying Yahoo:`, error)
        marketData = await fetchYahooQuote(symbol)
      }

      // Update price cache in database
      const { data: symbolData } = await supabase
        .from('symbols')
        .select('id')
        .eq('ticker', symbol.toUpperCase())
        .single()

      if (symbolData) {
        const { error } = await supabase
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

    if (body.action === 'batch_update') {
      const { symbols } = body
      const results: Array<{
        symbol: string
        success: boolean
        data?: MarketQuote
        source?: 'yahoo'
        error?: string
      }> = []

      for (let index = 0; index < symbols.length; index++) {
        const symbolItem = symbols[index]
        try {
          const marketData = await fetchAlphaVantageQuote(symbolItem.ticker)

          // Update price cache
          const { error } = await supabase
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

          // Rate limiting - wait 12 seconds between requests (AlphaVantage free tier: 5 calls/min)
          if (index < symbols.length - 1) {
            await new Promise<void>(resolve => setTimeout(resolve, 12000))
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbolItem.ticker}:`, error)
          // Try Yahoo Finance as backup
          try {
            const yahooData = await fetchYahooQuote(symbolItem.ticker)

            const { error: updateError } = await supabase
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
            const alphaMessage = getErrorMessage(error)
            const yahooMessage = getErrorMessage(yahooError)
            console.error(`Yahoo fallback also failed for ${symbolItem.ticker}:`, yahooError)
            results.push({
              symbol: symbolItem.ticker,
              success: false,
              error: `${alphaMessage}; Yahoo fallback: ${yahooMessage}`
            })
          }
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (body.action === 'historical') {
      // Fetch historical data for major indices
      const majorIndices = ['SPY', 'QQQ', 'IWM'] // S&P 500, NASDAQ, Russell 2000

      for (const index of majorIndices) {
        try {
          await fetchHistoricalData(index)
          // Rate limiting
          await new Promise<void>(resolve => setTimeout(resolve, 12000))
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
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})