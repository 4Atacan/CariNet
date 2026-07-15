import { describe, expect, it } from 'vitest';
import { hibpHashParts, suffixInRange } from './breached-password.service';

/** §11.1 — HIBP k-anonimlik: parola aga cikmadan (yalniz ilk 5 hex) sizinti kontrolu. */
describe('breached-password (HIBP k-anonimlik)', () => {
  it('SHA-1 hash prefix (5) + suffix ayrimini dogru yapar', () => {
    // SHA1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const { prefix, suffix } = hibpHashParts('password');
    expect(prefix).toBe('5BAA6');
    expect(suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(prefix).toHaveLength(5);
  });

  it('farkli parolalar farkli prefix uretir (deterministik)', () => {
    expect(hibpHashParts('a').prefix).not.toBe(hibpHashParts('b').prefix);
    expect(hibpHashParts('same').prefix).toBe(hibpHashParts('same').prefix);
  });

  const body = [
    '0018A45C4D1DEF81644B54AB7F969B88D65:12',
    '1E4C9B93F3F0682250B6CF8331B7EE68FD8:38571',
    '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2',
  ].join('\r\n');

  it('suffix listede ve sayaci >0 ise sizmis sayar', () => {
    expect(suffixInRange('1E4C9B93F3F0682250B6CF8331B7EE68FD8', body)).toBe(true);
  });

  it('suffix listede yoksa temiz sayar', () => {
    expect(suffixInRange('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', body)).toBe(false);
  });

  it('Add-Padding ile gelen sayaci 0 satirlari (sahte doldurma) elenir', () => {
    expect(suffixInRange('AAAA', 'AAAA:0\r\nBBBB:5')).toBe(false);
  });
});
