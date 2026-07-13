import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { AppError, ErrorCode, type AuthTokens, type JwtPayload } from '@carinet/shared';
import { type Env } from '../../config/env';
import { AuthRepository } from './auth.repository';

export interface RefreshPayload {
  sub: string;
  mem: string | null;
  fid: string; // family id
  jti: string;
}

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

/** Yuksek entropili token → sha256 yeterli (argon2 gereksiz; hiz kritik). */
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly repo: AuthRepository,
  ) {}

  /** Yeni oturum: yeni aile (family) acar. */
  async issue(payload: JwtPayload, meta: ClientMeta): Promise<AuthTokens> {
    return this.mint(payload, randomBytes(16).toString('hex'), meta);
  }

  /**
   * §6.3 — refresh rotasyonu + REUSE TESPITI.
   * Iptal edilmis bir token tekrar kullanilirsa ailenin tamami toptan iptal edilir.
   */
  async rotate(
    refreshToken: string,
    rebuild: (userId: string, membershipCtx: string | null) => Promise<JwtPayload>,
    meta: ClientMeta,
  ): Promise<AuthTokens> {
    await this.verifyRefresh(refreshToken); // imza + sure kontrolu
    const record = await this.repo.findRefreshTokenByHash(sha256(refreshToken));

    if (!record) {
      // Imzasi gecerli ama kayitta yok → aile silinmis/iptal edilmis.
      throw new AppError(ErrorCode.UNAUTHORIZED);
    }

    if (record.revokedAt) {
      this.logger.warn(
        `Refresh token yeniden kullanildi (reuse) — aile iptal ediliyor: family=${record.familyId}`,
      );
      await this.repo.revokeFamily(record.familyId);
      throw new AppError(ErrorCode.TOKEN_REUSED);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED);
    }

    const next = await rebuild(record.userId, record.membershipCtx);
    const tokens = await this.mint(next, record.familyId, meta);
    await this.repo.revokeRefreshToken(record.id, sha256(tokens.refreshToken));
    return tokens;
  }

  /** Hesap degistirme: ayni kullanici, YENI baglam → yeni aile (§6.2). */
  async reissueForContext(payload: JwtPayload, meta: ClientMeta): Promise<AuthTokens> {
    return this.issue(payload, meta);
  }

  async revoke(refreshToken: string): Promise<void> {
    const record = await this.repo.findRefreshTokenByHash(sha256(refreshToken));
    if (record && !record.revokedAt) {
      await this.repo.revokeFamily(record.familyId);
    }
  }

  revokeAll(userId: string): Promise<unknown> {
    return this.repo.revokeAllForUser(userId);
  }

  async verifyRefresh(token: string): Promise<RefreshPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new AppError(ErrorCode.TOKEN_EXPIRED);
    }
  }

  private async mint(payload: JwtPayload, familyId: string, meta: ClientMeta): Promise<AuthTokens> {
    // TTL env'den string gelir ("15m"); jsonwebtoken bunu `ms` sablon tipiyle bekler.
    type Ttl = JwtSignOptions['expiresIn'];
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true }) as Ttl;
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true }) as Ttl;
    const jti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { ...payload, jti },
      { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }), expiresIn: accessTtl },
    );

    const refreshPayload: RefreshPayload = {
      sub: payload.sub,
      mem: payload.mem,
      fid: familyId,
      jti: randomUUID(),
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTtl,
    });

    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.repo.createRefreshToken({
      userId: payload.sub,
      membershipCtx: payload.mem,
      familyId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    const accessDecoded = this.jwt.decode<{ exp: number; iat: number }>(accessToken);
    return { accessToken, refreshToken, expiresIn: accessDecoded.exp - accessDecoded.iat };
  }
}

export { sha256 };
