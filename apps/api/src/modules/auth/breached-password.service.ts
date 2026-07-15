import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError, ErrorCode } from '@carinet/shared';
import { type Env } from '../../config/env';

/**
 * §11.1 — sizmis parola kontrolu (Have I Been Pwned, k-anonimlik). UCRETSIZ, anahtar gerektirmez (kural #8).
 *
 * Parolanin SHA-1'i alinir; servise YALNIZ ilk 5 hex hanesi gider → parola/hash aga cikmaz (k-anonimlik).
 * Servis o prefix ile eslesen tum suffix'leri sayaclariyla doner; suffix'imiz listedeyse parola sizmistir.
 *
 * FAIL-OPEN: HIBP erisilemezse kullanici ENGELLENMEZ — ucuncu taraf kesintisi kayit/sifre sifirlamayi
 * kirmamali. Guvenlik icin ideal degil ama erisilebilirlik icin dogru taviz (log'a dusulur).
 */
@Injectable()
export class BreachedPasswordService {
  private readonly logger = new Logger(BreachedPasswordService.name);
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    // Testte kapali (e2e hermetik olmali, aga cikmamali); dev/prod'da acik.
    this.enabled = config.get('NODE_ENV', { infer: true }) !== 'test';
  }

  /** Parola bir veri sizintisinda goruldu mu? Erisim yoksa false (fail-open). */
  async isBreached(password: string): Promise<boolean> {
    if (!this.enabled) return false;
    const { prefix, suffix } = hibpHashParts(password);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      return suffixInRange(suffix, await res.text());
    } catch (error) {
      this.logger.warn({ err: error }, 'HIBP erisilemedi — sizinti kontrolu atlandi (fail-open)');
      return false;
    }
  }

  /** Sizmissa AppError firlatir. Sifre BELIRLEYEN her yolda cagrilir (kayit, sifirlama, degistirme). */
  async assertNotBreached(password: string): Promise<void> {
    if (await this.isBreached(password)) throw new AppError(ErrorCode.PASSWORD_COMPROMISED);
  }
}

/** SHA-1 → { prefix: ilk 5 hex (buyuk harf), suffix: kalan }. Saf fonksiyon → unit testlenebilir. */
export function hibpHashParts(password: string): { prefix: string; suffix: string } {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

/** HIBP yaniti "SUFFIX:COUNT" satirlaridir; suffix'imiz >0 sayaçla varsa true. Padding (count 0) elenir. */
export function suffixInRange(suffix: string, body: string): boolean {
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    if (line.slice(0, idx).trim().toUpperCase() !== suffix) continue;
    const count = Number(line.slice(idx + 1).trim());
    return Number.isFinite(count) && count > 0;
  }
  return false;
}
