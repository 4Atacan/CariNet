import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMoney, type MoneyString } from '@carinet/shared';

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

/** Para gosterimi tek noktadan (kural #1: gosterimde de decimal.js kaynakli string). */
export const money = (value: MoneyString, currency = 'TRY'): string => formatMoney(value, currency);

/** ISO tarih → 01.02.2026 */
export const trDate = (iso: string | Date | null | undefined): string => {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul' }).format(d);
};

/** Bakiye rengi: pozitif = alici borclu (kirmizi), negatif = alacakli (yesil). */
export const balanceTone = (value: MoneyString): string =>
  value.startsWith('-')
    ? 'text-emerald-600'
    : Number(value) === 0
      ? 'text-slate-500'
      : 'text-red-600';
