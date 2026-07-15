import { describe, expect, it } from 'vitest';
import { TwoFactorService, hashBackupCode, normalizeBackupCode } from './two-factor.service';

describe('two-factor (§11.1 TOTP enrollment)', () => {
  const svc = new TwoFactorService();

  it('otpauth URL secret ve issuer icerir', () => {
    const { secret, otpauthUrl } = svc.generateSecret('ali@ornek.com');
    expect(secret.length).toBeGreaterThan(0);
    expect(otpauthUrl).toContain('otpauth://totp/');
    expect(otpauthUrl).toContain('CariNet');
    expect(otpauthUrl).toContain(`secret=${secret}`);
  });

  it('10 yedek kod uretir; hash sayisi kod sayisina esit', () => {
    const { plain, hashes } = svc.generateBackupCodes();
    expect(plain).toHaveLength(10);
    expect(hashes).toHaveLength(10);
    expect(new Set(plain).size).toBe(10); // benzersiz
    expect(hashes[0]).toBe(hashBackupCode(plain[0]!));
  });

  it('yedek kod normalize edilir: bosluk/tire/buyuk-kucuk fark etmez', () => {
    expect(normalizeBackupCode('4F3A-9C2B')).toBe('4f3a9c2b');
    expect(hashBackupCode('4f3a-9c2b')).toBe(hashBackupCode('4F3A 9C2B'));
  });
});
