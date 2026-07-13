import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type Request } from 'express';
import { AppError, ErrorCode, jwtPayloadSchema } from '@carinet/shared';
import { type Env } from '../../../config/env';
import { type RequestUser } from '../../../common/types/request-with-user';

/** Panel cookie ile, mobil Authorization basligi ile gelir (kural #9). */
const fromCookie = (req: Request): string | null => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Kural #7: JWT payload'i da bir dis sinirdir → Zod. */
  validate(raw: unknown): RequestUser {
    const parsed = jwtPayloadSchema.safeParse(raw);
    if (!parsed.success) throw new AppError(ErrorCode.UNAUTHORIZED);

    const payload = parsed.data;
    return {
      userId: payload.sub,
      membershipId: payload.mem,
      role: payload.role,
      sellerId: payload.sellerId,
      buyerAccountId: payload.buyerAccountId,
    };
  }
}
