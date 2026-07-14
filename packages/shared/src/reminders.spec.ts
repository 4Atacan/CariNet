import { describe, expect, it } from 'vitest';
import { DUE_SOON_DAYS, daysUntilDue, reminderFor, reminderText } from './reminders';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const ASOF = day('2026-07-14');

describe('daysUntilDue', () => {
  it('saat farkini yok sayar, takvim gunu sayar', () => {
    expect(daysUntilDue(day('2026-07-17'), new Date('2026-07-14T23:59:00.000Z'))).toBe(3);
    expect(daysUntilDue(day('2026-07-14'), new Date('2026-07-14T00:01:00.000Z'))).toBe(0);
  });

  it('gecmis vade negatif doner', () => {
    expect(daysUntilDue(day('2026-07-07'), ASOF)).toBe(-7);
  });
});

describe('reminderFor', () => {
  it('vadeye 3 gun kala hatirlatir', () => {
    expect(reminderFor(day('2026-07-17'), ASOF)).toBe('DUE_SOON');
  });

  it('vade gunu hatirlatir', () => {
    expect(reminderFor(day('2026-07-14'), ASOF)).toBe('DUE_TODAY');
  });

  it('vadesi 1 / 7 / 30 gun gecince tekrar hatirlatir', () => {
    expect(reminderFor(day('2026-07-13'), ASOF)).toBe('OVERDUE');
    expect(reminderFor(day('2026-07-07'), ASOF)).toBe('OVERDUE');
    expect(reminderFor(day('2026-06-14'), ASOF)).toBe('OVERDUE');
  });

  it('HER GUN spam yapmaz — ara gunlerde sessiz kalir', () => {
    expect(reminderFor(day('2026-07-12'), ASOF)).toBeNull(); // 2 gun gecmis
    expect(reminderFor(day('2026-07-09'), ASOF)).toBeNull(); // 5 gun gecmis
    expect(reminderFor(day('2026-06-20'), ASOF)).toBeNull(); // 24 gun gecmis
  });

  it('vadesi uzak fatura icin hatirlatma uretmez', () => {
    expect(reminderFor(day('2026-07-16'), ASOF)).toBeNull(); // 2 gun var
    expect(reminderFor(day('2026-08-14'), ASOF)).toBeNull(); // 31 gun var
  });

  it('esik degeri DUE_SOON_DAYS sabitine bagli', () => {
    const due = new Date(ASOF);
    due.setUTCDate(due.getUTCDate() + DUE_SOON_DAYS);
    expect(reminderFor(due, ASOF)).toBe('DUE_SOON');
  });
});

describe('reminderText', () => {
  it('belge no varsa metne girer', () => {
    const t = reminderText('DUE_SOON', 'FTR-2026-001', '12.000,00 ₺', 0);
    expect(t.body).toContain('FTR-2026-001');
    expect(t.body).toContain('3 gun');
  });

  it('belge no yoksa metin bozulmaz', () => {
    const t = reminderText('DUE_TODAY', null, '500,00 ₺', 0);
    expect(t.body).not.toContain('()');
    expect(t.title).toBe('Bugun vadesi dolan odeme');
  });

  it('vadesi gecen metninde gun sayisi gorunur', () => {
    const t = reminderText('OVERDUE', 'F-9', '1.000,00 ₺', 7);
    expect(t.body).toContain('7 gundur');
  });
});
