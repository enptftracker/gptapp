const logoDomains: Record<string, string> = {
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
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  VTI: 'vanguard.com',
  IWM: 'ishares.com',
  EFA: 'ishares.com',
  COIN: 'coinbase.com',
  MSTR: 'microstrategy.com',
};

export function getLogoUrl(ticker: string, name?: string) {
  const domain = logoDomains[ticker.toUpperCase()];
  if (domain) {
    return `https://logo.clearbit.com/${domain}?size=80`;
  }

  const fallbackLabel = encodeURIComponent(name || ticker);
  return `https://ui-avatars.com/api/?name=${fallbackLabel}&background=random&color=ffffff&length=3`;
}

