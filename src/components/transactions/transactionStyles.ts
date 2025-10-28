import { Transaction } from '@/lib/supabase';

export type TransactionTypeStyleKey = Transaction['type'] | 'DEFAULT';

export interface TransactionTypeStyles {
  badge: string;
  row: string;
  stickyCell: string;
  hover: string;
  button: string;
  buttonHover: string;
}

export const transactionTypeStyles: Record<TransactionTypeStyleKey, TransactionTypeStyles> = {
  BUY: {
    badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200',
    row: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    stickyCell: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    hover: 'hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50',
    button:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-emerald-200/60 dark:data-[state=on]:ring-emerald-400/40',
    buttonHover: 'data-[state=on]:hover:bg-emerald-200/80 dark:data-[state=on]:hover:bg-emerald-800/60'
  },
  DIVIDEND: {
    badge: 'bg-lime-100 text-lime-900 dark:bg-lime-900/60 dark:text-lime-200',
    row: 'bg-lime-50/80 dark:bg-lime-950/40',
    stickyCell: 'bg-lime-50/80 dark:bg-lime-950/40',
    hover: 'hover:bg-lime-100/80 dark:hover:bg-lime-900/50',
    button:
      'bg-lime-100 text-lime-900 dark:bg-lime-900/60 dark:text-lime-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-lime-200/60 dark:data-[state=on]:ring-lime-400/40',
    buttonHover: 'data-[state=on]:hover:bg-lime-200/80 dark:data-[state=on]:hover:bg-lime-800/60'
  },
  SELL: {
    badge: 'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-200',
    row: 'bg-red-50/80 dark:bg-red-950/40',
    stickyCell: 'bg-red-50/80 dark:bg-red-950/40',
    hover: 'hover:bg-red-100/80 dark:hover:bg-red-900/50',
    button:
      'bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-red-200/60 dark:data-[state=on]:ring-red-400/40',
    buttonHover: 'data-[state=on]:hover:bg-red-200/80 dark:data-[state=on]:hover:bg-red-800/60'
  },
  DEPOSIT: {
    badge: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30',
    button:
      'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-sky-200/60 dark:data-[state=on]:ring-sky-400/40',
    buttonHover: 'data-[state=on]:hover:bg-sky-200/80 dark:data-[state=on]:hover:bg-sky-800/60'
  },
  WITHDRAW: {
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30',
    button:
      'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-amber-200/60 dark:data-[state=on]:ring-amber-400/40',
    buttonHover: 'data-[state=on]:hover:bg-amber-200/80 dark:data-[state=on]:hover:bg-amber-800/60'
  },
  FEE: {
    badge: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30',
    button:
      'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-zinc-200/60 dark:data-[state=on]:ring-zinc-400/40',
    buttonHover: 'data-[state=on]:hover:bg-zinc-200/80 dark:data-[state=on]:hover:bg-zinc-800/60'
  },
  DEFAULT: {
    badge: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200',
    row: 'bg-muted/40 dark:bg-muted/20',
    stickyCell: 'bg-muted/40 dark:bg-muted/20',
    hover: 'hover:bg-muted/60 dark:hover:bg-muted/30',
    button:
      'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-200 data-[state=on]:shadow-md data-[state=on]:ring-1 data-[state=on]:ring-zinc-200/60 dark:data-[state=on]:ring-zinc-400/40',
    buttonHover: 'data-[state=on]:hover:bg-zinc-200/80 dark:data-[state=on]:hover:bg-zinc-800/60'
  }
};

export const getTransactionTypeStyles = (type?: string) => {
  if (!type) {
    return transactionTypeStyles.DEFAULT;
  }

  const normalizedType = type.toUpperCase();

  return (
    transactionTypeStyles[normalizedType as Transaction['type']] ?? transactionTypeStyles.DEFAULT
  );
};
