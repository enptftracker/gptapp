import { cn } from '@/lib/utils';

export interface InstrumentFilterStyles {
  button: string;
  buttonHover: string;
}

const baseActiveClasses =
  'data-[state=on]:border-opacity-70 data-[state=on]:shadow-sm data-[state=on]:text-neutral-900 dark:data-[state=on]:text-white/90';

const instrumentTypeStyles: Record<string, InstrumentFilterStyles> = {
  CASH: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-emerald-300 data-[state=on]:bg-emerald-100 dark:data-[state=on]:border-emerald-400/60 dark:data-[state=on]:bg-emerald-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-emerald-200/70 dark:data-[state=on]:hover:bg-emerald-800/60'
  },
  EQUITY: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-sky-300 data-[state=on]:bg-sky-100 dark:data-[state=on]:border-sky-400/60 dark:data-[state=on]:bg-sky-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-sky-200/70 dark:data-[state=on]:hover:bg-sky-800/60'
  },
  ETF: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-indigo-300 data-[state=on]:bg-indigo-100 dark:data-[state=on]:border-indigo-400/60 dark:data-[state=on]:bg-indigo-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-indigo-200/70 dark:data-[state=on]:hover:bg-indigo-800/60'
  },
  FUND: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-amber-300 data-[state=on]:bg-amber-100 dark:data-[state=on]:border-amber-400/60 dark:data-[state=on]:bg-amber-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-amber-200/70 dark:data-[state=on]:hover:bg-amber-800/60'
  },
  CRYPTO: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-orange-300 data-[state=on]:bg-orange-100 dark:data-[state=on]:border-orange-400/60 dark:data-[state=on]:bg-orange-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-orange-200/70 dark:data-[state=on]:hover:bg-orange-800/60'
  },
  BOND: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-violet-300 data-[state=on]:bg-violet-100 dark:data-[state=on]:border-violet-400/60 dark:data-[state=on]:bg-violet-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-violet-200/70 dark:data-[state=on]:hover:bg-violet-800/60'
  },
  OTHER: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-zinc-300 data-[state=on]:bg-zinc-100 dark:data-[state=on]:border-zinc-500/60 dark:data-[state=on]:bg-zinc-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-zinc-200/70 dark:data-[state=on]:hover:bg-zinc-800/60'
  },
  DEFAULT: {
    button: cn(
      baseActiveClasses,
      'data-[state=on]:border-zinc-300 data-[state=on]:bg-zinc-100 dark:data-[state=on]:border-zinc-500/60 dark:data-[state=on]:bg-zinc-900/60'
    ),
    buttonHover: 'data-[state=on]:hover:bg-zinc-200/70 dark:data-[state=on]:hover:bg-zinc-800/60'
  }
};

export const getInstrumentTypeStyles = (type?: string): InstrumentFilterStyles => {
  if (!type) {
    return instrumentTypeStyles.DEFAULT;
  }

  const normalized = type.toUpperCase();
  return instrumentTypeStyles[normalized] ?? instrumentTypeStyles.DEFAULT;
};
