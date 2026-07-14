import { formatMoney, type MoneyString } from '@carinet/shared';

export const money = (value: MoneyString, currency = 'TRY'): string => formatMoney(value, currency);

export const trDate = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul' }).format(new Date(iso))
    : '—';

/** Pozitif bakiye = alici borclu (kirmizi); negatif = alacakli (yesil). */
export const balanceColor = (value: MoneyString): string =>
  value.startsWith('-') ? '#059669' : Number(value) === 0 ? '#64748b' : '#dc2626';

/** Limit kullanim yuzdesi — yalniz GOSTERIM icin (hesap sunucuda). */
export const limitUsage = (balance: MoneyString, limit: MoneyString): number => {
  const l = Number(limit);
  if (l <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(balance) / l) * 100)));
};
