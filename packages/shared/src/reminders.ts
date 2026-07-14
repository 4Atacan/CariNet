/**
 * §13 Faz 4 — vade hatirlatma cronunun SAF cekirdegi.
 * "Hangi faturaya, hangi gun, hangi metinle hatirlatma gider?" karari burada; DB yok, IO yok.
 * Boylece "vadesi yaklasan seed faturasi cron bildirimi uretiyor" kriteri testle kanitlanabilir.
 */

export const REMINDER_KINDS = ['DUE_SOON', 'DUE_TODAY', 'OVERDUE'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Vadeye kac gun kala hatirlatilir (§13: "vade hatirlatma"). */
export const DUE_SOON_DAYS = 3;
/** Vadesi gectikten sonra hatirlatmanin tekrarlanacagi gunler. Her gun spam yapmayiz. */
export const OVERDUE_REMINDER_DAYS = [1, 7, 30] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gun farki (takvim gunu, saat farki yok sayilir). Pozitif = vade GELECEKTE. */
export function daysUntilDue(dueDate: Date, asOf: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const now = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.round((due - now) / MS_PER_DAY);
}

/**
 * Bugun bu vade icin hatirlatma gonderilmeli mi?
 * null → gonderilmez (ne yaklasan ne de tekrar gunu).
 *
 * Kapali borc icin CAGRILMAZ: hangi faturanin acik oldugu FIFO ile (computeAging) bulunur,
 * hatirlatma yalniz ACIK kalemler icin uretilir.
 */
export function reminderFor(dueDate: Date, asOf: Date): ReminderKind | null {
  const days = daysUntilDue(dueDate, asOf);

  if (days === 0) return 'DUE_TODAY';
  if (days === DUE_SOON_DAYS) return 'DUE_SOON';
  if (days < 0 && (OVERDUE_REMINDER_DAYS as readonly number[]).includes(-days)) return 'OVERDUE';
  return null;
}

/** Bildirim metni (§12: UI metinleri Turkce). */
export function reminderText(
  kind: ReminderKind,
  documentNo: string | null,
  amount: string,
  overdueDays: number,
): { title: string; body: string } {
  const belge = documentNo ? ` (${documentNo})` : '';
  switch (kind) {
    case 'DUE_SOON':
      return {
        title: 'Vadesi yaklasan odeme',
        body: `${amount} tutarindaki borcunuzun${belge} vadesine ${DUE_SOON_DAYS} gun kaldi.`,
      };
    case 'DUE_TODAY':
      return {
        title: 'Bugun vadesi dolan odeme',
        body: `${amount} tutarindaki borcunuzun${belge} vadesi BUGUN doluyor.`,
      };
    case 'OVERDUE':
      return {
        title: 'Vadesi gecen odeme',
        body: `${amount} tutarindaki borcunuz${belge} ${overdueDays} gundur vadesi gecmis durumda.`,
      };
  }
}
