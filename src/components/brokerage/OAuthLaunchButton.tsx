/**
 * OAuth-based brokerage connections are currently disabled while we only support
 * direct Trading 212 API token connections. This placeholder exists as an
 * explicit guard so any accidental usage becomes obvious during development.
 */
export function BrokerageOAuthLaunchButton() {
  if (import.meta.env.DEV) {
    console.warn('BrokerageOAuthLaunchButton is disabled until OAuth providers are available.');
  }

  return null;
}
