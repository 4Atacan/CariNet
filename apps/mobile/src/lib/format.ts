import { formatMoney, type MoneyString } from '@carinet/shared';
import { color } from './theme';

export const money = (value: MoneyString, currency = 'TRY'): string => formatMoney(value, currency);

export const trDate = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
    : '—';

/** Pozitif bakiye = alici borclu (debit); negatif = alacakli (credit); sifir = notr. */
export const balanceColor = (value: MoneyString): string =>
  value.startsWith('-') ? color.credit : Number(value) === 0 ? color.ink[500] : color.debit;

/** Limit kullanim yuzdesi — yalniz GOSTERIM icin (hesap sunucuda). */
export const limitUsage = (balance: MoneyString, limit: MoneyString): number => {
  const l = Number(limit);
  if (l <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(balance) / l) * 100)));
};
