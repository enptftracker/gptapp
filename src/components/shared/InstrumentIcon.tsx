import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getInstrumentBranding,
  getInstrumentFallbackLabel,
  type InstrumentBranding,
} from '@/lib/branding';

export type InstrumentIconSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<InstrumentIconSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

const textSizeClasses: Record<InstrumentIconSize, string> = {
  sm: 'text-[0.6rem]',
  md: 'text-xs',
  lg: 'text-sm',
};

interface InstrumentIconProps {
  ticker: string;
  name?: string;
  size?: InstrumentIconSize;
  className?: string;
}

export function InstrumentIcon({ ticker, name, size = 'md', className }: InstrumentIconProps) {
  const fallbackLabel = useMemo(
    () => getInstrumentFallbackLabel(ticker, name),
    [ticker, name]
  );
  const [branding, setBranding] = useState<InstrumentBranding>({
    logoUrl: null,
    fallbackLabel,
  });
  const [imageError, setImageError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);

  useEffect(() => {
    let isActive = true;
    setImageError(false);
    setIsImageLoaded(false);
    setIsLoadingBranding(true);
    setBranding({ logoUrl: null, fallbackLabel });

    getInstrumentBranding(ticker, name)
      .then((result) => {
        if (!isActive) return;
        setBranding(result);
      })
      .catch((error) => {
        console.error('Failed to load instrument branding', error);
        if (!isActive) return;
        setBranding({ logoUrl: null, fallbackLabel });
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingBranding(false);
      });

    return () => {
      isActive = false;
    };
  }, [ticker, name, fallbackLabel]);

  const showFallback =
    imageError || !branding.logoUrl || (!isImageLoaded && !imageError);

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden p-1',
        sizeClasses[size],
        className,
        showFallback
          ? 'rounded-full border border-border bg-muted text-muted-foreground font-semibold uppercase'
          : 'rounded-lg bg-transparent'
      )}
    >
      {branding.logoUrl && !imageError && (
        <img
          src={branding.logoUrl}
          alt={`${name ?? ticker} logo`}
          className={cn(
            'max-h-full max-w-full object-contain transition-opacity duration-200',
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          )}
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          onError={() => setImageError(true)}
        />
      )}
      {showFallback && (
        <span
          className={cn(
            'tracking-wide transition-opacity duration-150',
            textSizeClasses[size],
            isLoadingBranding ? 'animate-pulse' : undefined
          )}
        >
          {branding.fallbackLabel}
        </span>
      )}
    </div>
  );
}

