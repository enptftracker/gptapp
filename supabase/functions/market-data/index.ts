import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

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

type HistoricalRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX'

const yahooRangeConfig: Record<HistoricalRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '15m' },
  '1W': { range: '5d', interval: '1h' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
  '5Y': { range: '5y', interval: '1mo' },
  'MAX': { range: 'max', interval: '3mo' }
}

interface HistoricalDailyPoint {
  date: string
  price: number
}

interface HistoricalDailyResult {
  source: 'alphavantage' | 'yahoo'
  points: HistoricalDailyPoint[]
}

type MarketProvider = 'alphavantage' | 'yfinance'

const MAX_HISTORICAL_POINTS = 3652

const ALPHAVANTAGE_RANGE_DAY_LIMIT: Record<HistoricalRange, number | null> = {
  '1D': 1,
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 372,
  '5Y': 1860,
  'MAX': null
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

async function fetchYahooDailySeries(symbol: string): Promise<HistoricalDailyResult> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=10y&interval=1d` +
    '&includePrePost=false&events=div%2Csplits'

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Yahoo Finance historical request failed with status ${response.status}`)
  }

  const payload = await response.json()
  const result = payload?.chart?.result?.[0]

  if (!result) {
    throw new Error(`No Yahoo Finance historical data returned for ${symbol}`)
  }

  const timestamps: number[] | undefined = result.timestamp
  const quoteSeries: Array<number | null> | undefined = result.indicators?.quote?.[0]?.close
  const adjCloseSeries: Array<number | null> | undefined = result.indicators?.adjclose?.[0]?.adjclose

  const series = quoteSeries && quoteSeries.some(value => typeof value === 'number')
    ? quoteSeries
    : adjCloseSeries

  if (!timestamps || !series) {
    throw new Error(`Incomplete Yahoo historical data for ${symbol}`)
  }

  const points: HistoricalDailyPoint[] = timestamps
    .map((timestamp, index) => {
      const price = series[index]

      if (price === null || Number.isNaN(price)) {
        return null
      }

      const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

      return {
        date,
        price: Number.parseFloat(Number(price).toFixed(4))
      }
    })
    .filter((point): point is HistoricalDailyPoint => Boolean(point))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!points.length) {
    throw new Error(`Yahoo historical series contained no valid data points for ${symbol}`)
  }

  return {
    source: 'yahoo',
    points
  }
}

async function fetchYahooHistoricalRange(symbol: string, range: HistoricalRange) {
  const config = yahooRangeConfig[range]

  if (!config) {
    throw new Error(`Unsupported range ${range}`)
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${config.range}&interval=${config.interval}` +
    '&includePrePost=false&events=div%2Csplits'

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}`)
  }

  const payload = await response.json()
  const result = payload?.chart?.result?.[0]

  if (!result) {
    throw new Error(`No historical data returned for ${symbol}`)
  }

  const timestamps: number[] | undefined = result.timestamp
  const quoteSeries: Array<number | null> | undefined = result.indicators?.quote?.[0]?.close
  const adjCloseSeries: Array<number | null> | undefined = result.indicators?.adjclose?.[0]?.adjclose

  const series = quoteSeries && quoteSeries.some(value => typeof value === 'number')
    ? quoteSeries
    : adjCloseSeries

  if (!timestamps || !series) {
    throw new Error(`Incomplete historical data for ${symbol}`)
  }

  const points = timestamps
    .map((timestamp, index) => {
      const price = series[index]

      if (price === null || Number.isNaN(price)) {
        return null
      }

      return {
        time: new Date(timestamp * 1000).toISOString(),
        price: Number.parseFloat(price.toFixed(4))
      }
    })
    .filter((point): point is { time: string; price: number } => Boolean(point))

  if (points.length === 0) {
    throw new Error(`Historical series contained no valid data points for ${symbol}`)
  }

  const currency = result.meta?.currency ?? 'USD'

  return {
    symbol: symbol.toUpperCase(),
    currency,
    range,
    points: points.slice(-800) // defensive limit to avoid huge payloads
  }
}

function normalizeProvider(input: unknown): MarketProvider {
  return input === 'yfinance' ? 'yfinance' : 'alphavantage'
}

function mapAlphaVantageSeriesToRange(
  series: HistoricalDailyPoint[],
  range: HistoricalRange
): { time: string; price: number }[] {
  const limit = ALPHAVANTAGE_RANGE_DAY_LIMIT[range]
  const trimmed = limit ? series.slice(-limit) : series

  return trimmed.map(point => ({
    time: `${point.date}T00:00:00Z`,
    price: point.price
  }))
}

async function fetchAlphaVantageHistoricalRange(symbol: string, range: HistoricalRange) {
  const daily = await fetchAlphaVantageDailySeries(symbol)
  const points = mapAlphaVantageSeriesToRange(daily.points, range)

  if (!points.length) {
    throw new Error(`AlphaVantage returned no data points for ${symbol}`)
  }

  return {
    symbol: symbol.toUpperCase(),
    currency: 'USD',
    range,
    points: points.slice(-800)
  }
}

async function fetchPreferredQuote(symbol: string, provider: MarketProvider) {
  if (provider === 'yfinance') {
    try {
      const yahooData = await fetchYahooQuote(symbol)
      return { data: yahooData, source: 'yahoo' as const }
    } catch (error) {
      console.error(`Yahoo Finance quote failed for ${symbol}, retrying with AlphaVantage:`, error)
      const alphaData = await fetchAlphaVantageQuote(symbol)
      return { data: alphaData, source: 'alphavantage' as const }
    }
  }

  try {
    const alphaData = await fetchAlphaVantageQuote(symbol)
    return { data: alphaData, source: 'alphavantage' as const }
  } catch (error) {
    console.error(`AlphaVantage quote failed for ${symbol}, retrying with Yahoo Finance:`, error)
    const yahooData = await fetchYahooQuote(symbol)
    return { data: yahooData, source: 'yahoo' as const }
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

async function fetchAlphaVantageDailySeries(symbol: string): Promise<HistoricalDailyResult> {
  const apiKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
  if (!apiKey) {
    throw new Error('AlphaVantage API key not configured')
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${apiKey}`

  console.log(`Fetching AlphaVantage historical data for ${symbol}`)

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`AlphaVantage historical request failed with status ${response.status}`)
  }

  const data = await response.json()

  if (data['Error Message']) {
    throw new Error(`AlphaVantage error: ${data['Error Message']}`)
  }

  if (data['Note']) {
    throw new Error(`AlphaVantage rate limit: ${data['Note']}`)
  }

  const timeSeries = data['Time Series (Daily)']
  if (!timeSeries) {
    throw new Error(`No AlphaVantage historical data returned for symbol ${symbol}`)
  }

  const points: HistoricalDailyPoint[] = Object.entries(timeSeries)
    .map(([date, value]) => {
      const close = Number.parseFloat((value as Record<string, string>)['4. close'])
      if (Number.isNaN(close)) {
        return null
      }

      return {
        date,
        price: Number.parseFloat(close.toFixed(4))
      }
    })
    .filter((point): point is HistoricalDailyPoint => Boolean(point))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!points.length) {
    throw new Error(`AlphaVantage historical series contained no valid data points for ${symbol}`)
  }

  return {
    source: 'alphavantage',
    points
  }
}

async function upsertHistoricalSeries(
  symbol: string,
  client: SupabaseClient,
  preferredProvider: MarketProvider
): Promise<{ count: number; source: 'alphavantage' | 'yahoo' }> {
  const normalizedSymbol = symbol.trim().toUpperCase()

  const { data: symbolData, error: symbolError } = await client
    .from('symbols')
    .select('id')
    .eq('ticker', normalizedSymbol)
    .maybeSingle()

  if (symbolError) {
    throw symbolError
  }

  if (!symbolData) {
    throw new Error(`Symbol ${normalizedSymbol} not found in database`)
  }

  let fetchResult: HistoricalDailyResult

  if (preferredProvider === 'yfinance') {
    try {
      fetchResult = await fetchYahooDailySeries(normalizedSymbol)
    } catch (error) {
      console.error(`Yahoo historical fetch failed for ${normalizedSymbol}:`, error)
      fetchResult = await fetchAlphaVantageDailySeries(normalizedSymbol)
    }
  } else {
    try {
      fetchResult = await fetchAlphaVantageDailySeries(normalizedSymbol)
    } catch (error) {
      console.error(`AlphaVantage historical fetch failed for ${normalizedSymbol}:`, error)
      fetchResult = await fetchYahooDailySeries(normalizedSymbol)
    }
  }

  const tenYearsAgo = new Date()
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)

  const filteredPoints = fetchResult.points
    .filter(point => new Date(`${point.date}T00:00:00Z`) >= tenYearsAgo)
    .slice(-MAX_HISTORICAL_POINTS)

  const batches: HistoricalDailyPoint[][] = []
  const batchSize = 200
  for (let i = 0; i < filteredPoints.length; i += batchSize) {
    batches.push(filteredPoints.slice(i, i + batchSize))
  }

  for (const batch of batches) {
    const payload = batch.map(point => ({
      symbol_id: symbolData.id,
      date: point.date,
      price: point.price,
      price_currency: 'USD'
    }))

    const { error } = await client
      .from('historical_price_cache')
      .upsert(payload, { onConflict: 'symbol_id,date' })

    if (error) {
      throw error
    }
  }

  console.log(`Upserted ${filteredPoints.length} historical prices for ${normalizedSymbol} from ${fetchResult.source}`)

  return {
    count: filteredPoints.length,
    source: fetchResult.source
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

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

    const { action, symbol, symbols, range, provider } = await req.json()

    const preferredProvider = normalizeProvider(provider)

    if (typeof action !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          alphaConfigured: Boolean(Deno.env.get('ALPHAVANTAGE_API_KEY')),
          serviceRoleConfigured: Boolean(serviceRoleKey),
          anonKeyConfigured: Boolean(anonKey)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (action === 'quote') {
      if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const normalizedSymbol = symbol.trim().toUpperCase()

      const { data: marketData } = await fetchPreferredQuote(normalizedSymbol, preferredProvider)

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
          const { data: marketData, source } = await fetchPreferredQuote(symbolItem.ticker, preferredProvider)

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

          results.push({ symbol: symbolItem.ticker, success: true, data: marketData, source })

          if (index < sanitizedSymbols.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 12000))
          }
        } catch (error) {
          const fallbackError = error instanceof Error ? error.message : String(error)
          results.push({ symbol: symbolItem.ticker, success: false, error: fallbackError })
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'historical_range') {
      if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (typeof range !== 'string') {
        return new Response(JSON.stringify({ error: 'Unsupported range' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const normalizedRangeInput = range.trim().toUpperCase()

      if (!Object.prototype.hasOwnProperty.call(yahooRangeConfig, normalizedRangeInput)) {
        return new Response(JSON.stringify({ error: 'Unsupported range' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const normalizedSymbol = symbol.trim().toUpperCase()
      const normalizedRange = normalizedRangeInput as HistoricalRange

      const providerOrder: MarketProvider[] = preferredProvider === 'yfinance'
        ? ['yfinance', 'alphavantage']
        : ['alphavantage', 'yfinance']

      for (const providerOption of providerOrder) {
        try {
          const historical = providerOption === 'alphavantage'
            ? await fetchAlphaVantageHistoricalRange(normalizedSymbol, normalizedRange)
            : await fetchYahooHistoricalRange(normalizedSymbol, normalizedRange)

          return new Response(JSON.stringify(historical), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error(`Historical data fetch failed for ${normalizedSymbol} via ${providerOption}:`, error)
        }
      }

      return new Response(JSON.stringify({ error: 'Unable to fetch historical data from available providers.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'historical') {
      const requestedSymbols = Array.isArray(symbols)
        ? Array.from(
            new Set(
              symbols
                .filter((item): item is string => typeof item === 'string')
                .map(item => item.trim().toUpperCase())
                .filter(Boolean)
            )
          )
        : []

      const targets = requestedSymbols.length > 0 ? requestedSymbols : ['SPY', 'QQQ', 'IWM']
      const results: Array<{ symbol: string; success: boolean; count?: number; source?: 'alphavantage' | 'yahoo'; error?: string }> = []

      for (let index = 0; index < targets.length; index++) {
        const ticker = targets[index]
        try {
          const summary = await upsertHistoricalSeries(ticker, adminClient, preferredProvider)
          results.push({ symbol: ticker, success: true, count: summary.count, source: summary.source })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`Error fetching historical data for ${ticker}:`, message)
          results.push({ symbol: ticker, success: false, error: message })
        }

        if (index < targets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 12000))
        }
      }

      const success = results.every(result => result.success)

      return new Response(JSON.stringify({ success, results }), {
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
