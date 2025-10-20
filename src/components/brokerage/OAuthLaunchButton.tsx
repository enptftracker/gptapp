import { useCallback } from 'react';
import { Link2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useBrokerageConnections, type ConnectBrokerageInput } from '@/hooks/useBrokerageConnections';

interface BrokerageOAuthLaunchButtonProps extends ButtonProps {
  provider?: ConnectBrokerageInput['provider'];
  redirectUri?: ConnectBrokerageInput['redirectUri'];
  scope?: ConnectBrokerageInput['scope'];
  openInNewTab?: boolean;
}

const DEFAULT_PROVIDER = 'alpaca';

export function BrokerageOAuthLaunchButton({
  provider = DEFAULT_PROVIDER,
  redirectUri,
  scope,
  openInNewTab = true,
  children,
  ...buttonProps
}: BrokerageOAuthLaunchButtonProps) {
  const { connect } = useBrokerageConnections({ disableList: true });

  const handleClick = useCallback(async () => {
    try {
      const result = await connect.mutateAsync({ provider, redirectUri, scope });
      if (result?.authorizationUrl) {
        if (openInNewTab) {
          window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = result.authorizationUrl;
        }
      }
    } catch (error) {
      console.error('Failed to launch brokerage OAuth flow', error);
    }
  }, [connect, provider, redirectUri, scope, openInNewTab]);

  const isLoading = connect.isPending;

  return (
    <Button onClick={handleClick} disabled={isLoading} {...buttonProps}>
      <Link2 className="mr-2 h-4 w-4" />
      {isLoading ? 'Launching…' : children ?? 'Connect brokerage'}
    </Button>
  );
}
