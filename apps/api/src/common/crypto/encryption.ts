import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Kural #10 — seller_pos_configs anahtarlari AES-256-GCM ile sifreli saklanir.
 * Bicim: base64(iv).base64(authTag).base64(ciphertext)
 * Master key: MASTER_ENCRYPTION_KEY (32 byte hex).
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const toKey = (masterKeyHex: string): Buffer => {
  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY 32 byte (64 hex karakter) olmali');
  }
  return key;
};

export function encryptSecret(plain: string, masterKeyHex: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, toKey(masterKeyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptSecret(payload: string, masterKeyHex: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Sifreli deger bozuk');

  const decipher = createDecipheriv(ALGORITHM, toKey(masterKeyHex), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Panelde gosterim: son 4 hane disinda maskeli (§11.3). */
export const maskSecret = (value: string): string =>
  value.length <= 4 ? '****' : `${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
