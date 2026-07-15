import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { type TwoFactorSetupResponse } from '@carinet/shared';

/**
 * §11.1 — TOTP (kural #11) enrollment yardimcisi. Secret uretimi, otpauth URL ve yedek kurtarma kodlari.
 * Dogrulama otplib ile; kod dogrulama/uretimi burada toplanir ki auth.service tek bir yerden cagirsin.
 */
const ISSUER = 'CariNet';
const BACKUP_CODE_COUNT = 10;

@Injectable()
export class TwoFactorService {
  /** Yeni aday secret + QR icin otpauth:// URL. */
  generateSecret(accountLabel: string): TwoFactorSetupResponse {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(accountLabel, ISSUER, secret);
    return { secret, otpauthUrl };
  }

  verify(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }

  /**
   * 10 okunabilir yedek kod (ornek: 4f3a-9c2b). Duz metin YALNIZ bir kez doner; DB'de sha256 saklanir.
   * Telefon kaybinda kilitlenmeyi onler (App Store incelemesi bunu bekler).
   */
  generateBackupCodes(): { plain: string[]; hashes: string[] } {
    const plain = Array.from(
      { length: BACKUP_CODE_COUNT },
      () => `${randomHex(4)}-${randomHex(4)}`,
    );
    return { plain, hashes: plain.map(hashBackupCode) };
  }
}

/** Kodlar yuksek entropili → sha256 yeterli. Bosluk/tire/buyuk-kucuk fark etmez (normalize edilir). */
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, '').toLowerCase();
}

function randomHex(chars: number): string {
  return randomBytes(Math.ceil(chars / 2))
    .toString('hex')
    .slice(0, chars);
}
