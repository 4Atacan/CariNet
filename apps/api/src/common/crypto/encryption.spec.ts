import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, maskSecret } from './encryption';

const KEY = 'a'.repeat(64); // 32 byte hex

describe('AES-256-GCM sir sifreleme (kural #10)', () => {
  it('sifreleyip cozer', () => {
    const secret = 'pos-api-key-12345';
    const enc = encryptSecret(secret, KEY);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc, KEY)).toBe(secret);
  });

  it('her sifrelemede farkli ciktilar uretir (rastgele IV)', () => {
    expect(encryptSecret('ayni', KEY)).not.toBe(encryptSecret('ayni', KEY));
  });

  it('kurcalanmis ciphertext cozulemez (authTag)', () => {
    const enc = encryptSecret('gizli', KEY);
    const [iv, tag, data] = enc.split('.');
    const tampered = [iv, tag, Buffer.from('baskaveri').toString('base64')].join('.');
    expect(() => decryptSecret(tampered, KEY)).toThrow();
    expect(data).toBeDefined();
  });

  it('yanlis anahtarla cozulemez', () => {
    const enc = encryptSecret('gizli', KEY);
    expect(() => decryptSecret(enc, 'b'.repeat(64))).toThrow();
  });

  it('gecersiz uzunlukta master key reddedilir', () => {
    expect(() => encryptSecret('x', 'kisa')).toThrow();
  });

  it('maskeler', () => {
    expect(maskSecret('1234567890')).toBe('******7890');
    expect(maskSecret('abc')).toBe('****');
  });
});
