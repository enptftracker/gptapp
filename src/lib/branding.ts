import { MarketDataService } from './marketData';

const clearbitDomains: Record<string, string> = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  META: 'meta.com',
  NFLX: 'netflix.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  JNJ: 'jnj.com',
  UNH: 'uhc.com',
  PFE: 'pfizer.com',
  KO: 'coca-colacompany.com',
  PEP: 'pepsico.com',
  WMT: 'walmart.com',
  MCD: 'mcdonalds.com',
  DIS: 'thewaltdisneycompany.com',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  VTI: 'vanguard.com',
  IWM: 'ishares.com',
  EFA: 'ishares.com',
  GLD: 'spdrgoldshares.com',
  SLV: 'ishares.com',
  ARKK: 'ark-funds.com',
  XLK: 'ssga.com',
  XLF: 'ssga.com',
  XLY: 'ssga.com',
  XLE: 'ssga.com',
  XLV: 'ssga.com',
  VT: 'vanguard.com',
  COIN: 'coinbase.com',
  MSTR: 'microstrategy.com',
  BITO: 'proshares.com',
};

const directLogos: Record<string, string> = {
  'BTC-USD': 'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png?1547033579',
  'ETH-USD': 'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png?1595348880',
  'SOL-USD': 'https://assets.coingecko.com/coins/images/4128/thumb/solana.png?1696492354',
  'ADA-USD': 'https://assets.coingecko.com/coins/images/975/thumb/cardano.png?1547034860',
  'DOGE-USD': 'https://assets.coingecko.com/coins/images/5/thumb/dogecoin.png?1547792256',
  'BNB-USD': 'https://assets.coingecko.com/coins/images/825/thumb/bnb-icon2_2x.png?1644979850',
  'MATIC-USD': 'https://assets.coingecko.com/coins/images/4713/thumb/polygon.png?1698233745',
};

export function getInstrumentFallbackLabel(ticker: string, name?: string) {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) {
    return '—';
  }

  if (normalized === 'CASH') {
    return 'CA$';
  }

  const source = (name || normalized)
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim();

  if (!source) {
    return normalized.slice(0, 3) || normalized;
  }

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return normalized.slice(0, 3) || normalized;
  }

  const initials = words.slice(0, 2).map((word) => word.charAt(0)).join('');
  return initials.toUpperCase();
}

export interface InstrumentBranding {
  logoUrl: string | null;
  fallbackLabel: string;
}

export async function getInstrumentBranding(
  ticker: string,
  name?: string
): Promise<InstrumentBranding> {
  const normalizedTicker = (ticker || '').trim().toUpperCase();
  const fallbackLabel = getInstrumentFallbackLabel(normalizedTicker, name);

  if (!normalizedTicker) {
    return {
      logoUrl: null,
      fallbackLabel,
    };
  }

  try {
    const finnhubLogo = await MarketDataService.getLogo(normalizedTicker);
    if (finnhubLogo) {
      return {
        logoUrl: finnhubLogo,
        fallbackLabel,
      };
    }
  } catch (error) {
    console.error('Error retrieving Finnhub logo:', error);
  }

  const directLogo = directLogos[normalizedTicker];
  if (directLogo) {
    return {
      logoUrl: directLogo,
      fallbackLabel,
    };
  }

  const domain = clearbitDomains[normalizedTicker];
  if (domain) {
    return {
      logoUrl: `https://logo.clearbit.com/${domain}?size=128`,
      fallbackLabel,
    };
  }

  return {
    logoUrl: null,
    fallbackLabel,
  };
}

