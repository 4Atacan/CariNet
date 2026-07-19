import { describe, expect, it, vi } from 'vitest';
import { AppError, UserRole } from '@carinet/shared';
import { AuthService } from './auth.service';

/**
 * Kural #11 — prod'da SELLER_ADMIN / PLATFORM_ADMIN 2FA'siz calisamaz.
 *
 * Bulunan acik: `login` 2FA zorunlulugunu UYELIK rolunden cozuyordu
 * (`active?.role ?? BUYER_USER`). Platform admininin satici/alici uyeligi OLMAZ →
 * `active` bos → rol BUYER_USER'a duser → TWO_FA_ROLES eslesmez → kontrol hic calismaz.
 * Yani TOTP'si olmayan bir platform admini prod'da YALNIZ PAROLAYLA girebiliyordu.
 *
 * Neden e2e degil birim testi: bu dal yalnizca NODE_ENV=production iken caliliyor;
 * e2e paketini prod moduna almak rate limit ve Swagger davranisini da degistirir.
 * Burada yalnizca ilgili karar noktasi izole edilir.
 */

/** Uyeligi OLMAYAN, TOTP'si OLMAYAN platform admini — acigin tam kosulu. */
const platformAdmin = {
  id: 'u1',
  email: 'platform@carinet.local',
  phone: null,
  fullName: 'Platform Admin',
  passwordHash: 'hash',
  totpSecret: null,
  backupCodes: [],
  isPlatformAdmin: true,
  isActive: true,
};

function makeService(nodeEnv: 'production' | 'development') {
  const repo = {
    findUserByEmail: vi.fn().mockResolvedValue(platformAdmin),
    findSellerMemberships: vi.fn().mockResolvedValue([]),
    findAccountMemberships: vi.fn().mockResolvedValue([]),
    touchAccountMembership: vi.fn(),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(true), hash: vi.fn() };
  const tokens = { issue: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };
  const twoFactor = { verify: vi.fn(), generateSecret: vi.fn(), generateBackupCodes: vi.fn() };
  const breached = { assertNotBreached: vi.fn() };
  const audit = { log: vi.fn() };
  const mail = { sendPasswordReset: vi.fn() };
  const config = { get: vi.fn().mockReturnValue(nodeEnv) };

  return new AuthService(
    repo as never,
    passwords as never,
    tokens as never,
    twoFactor as never,
    breached as never,
    audit as never,
    mail as never,
    config as never,
  );
}

const meta = { ip: '127.0.0.1', userAgent: 'test' };
const input = { email: platformAdmin.email, password: 'dogru-parola' };

describe('2FA zorunlulugu — uyeligi olmayan PLATFORM_ADMIN (kural #11)', () => {
  it('prod: TOTP kurulu degilse giris ENGELLENIR', async () => {
    const service = makeService('production');

    await expect(service.login(input as never, meta)).rejects.toBeInstanceOf(AppError);
    await expect(service.login(input as never, meta)).rejects.toMatchObject({
      code: 'TOTP_REQUIRED',
    });
  });

  it('prod disinda ayni giris gecer (kural yalniz prod`da baglayici)', async () => {
    const service = makeService('development');

    const result = await service.login(input as never, meta);
    expect(result.user.role).toBe(UserRole.PLATFORM_ADMIN);
  });
});
