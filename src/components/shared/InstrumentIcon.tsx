import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getInstrumentBranding } from '@/lib/branding';

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
  const { logoUrl, fallbackLabel } = getInstrumentBranding(ticker, name);
  const [imageError, setImageError] = useState(false);

  const showFallback = imageError || !logoUrl;

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
      {showFallback ? (
        <span className={cn('tracking-wide', textSizeClasses[size])}>{fallbackLabel}</span>
      ) : (
        <img
          src={logoUrl ?? undefined}
          alt={`${name ?? ticker} logo`}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}

