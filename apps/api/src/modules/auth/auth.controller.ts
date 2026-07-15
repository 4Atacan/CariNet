import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { AppError, ErrorCode, UserRole, type AuthTokens } from '@carinet/shared';
import { CurrentUser, NoTenant, Public, RefreshRoute, Roles } from '../../common/decorators';
import { type RequestUser } from '../../common/types/request-with-user';
import { type Env } from '../../config/env';
import { AuthService } from './auth.service';
import {
  AcceptInviteDto,
  CreateInviteDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SwitchAccountDto,
  TwoFactorDisableDto,
  TwoFactorEnableDto,
  TwoFactorSetupDto,
} from './dto/auth.dto';
import { type ClientMeta } from './token.service';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // §11.1 brute-force kapisi
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'E-posta + sifre ile giris (kuresel kimlik)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.meta(req));
    this.setCookies(res, result.tokens);
    return result;
  }

  @RefreshRoute()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh rotasyonu (reuse tespitli)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readRefreshToken(req, dto);
    const tokens = await this.auth.refresh(token, this.meta(req));
    this.setCookies(res, tokens);
    return { tokens };
  }

  @RefreshRoute()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cikis — refresh ailesi iptal edilir' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.tryReadRefreshToken(req, dto);
    const result = await this.auth.logout(token);
    this.clearCookies(res);
    return result;
  }

  @NoTenant()
  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tum cihazlardan cikis (§11.8 olay plani)' })
  async revokeAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logoutAll(user.userId);
    this.clearCookies(res);
    return result;
  }

  @NoTenant()
  @Get('sessions')
  @ApiOperation({ summary: 'Acik oturumlar (cihaz listesi)' })
  sessions(@CurrentUser() user: RequestUser) {
    return this.auth.sessions(user.userId);
  }

  @NoTenant()
  @Get('me')
  @ApiOperation({ summary: 'Oturum sahibinin kimligi ve uyelik listesi' })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.userId);
  }

  @NoTenant()
  @Get('memberships')
  @ApiOperation({ summary: 'Hesap degistirici listesi (§6.2)' })
  memberships(@CurrentUser() user: RequestUser) {
    return this.auth.listMemberships(user.userId);
  }

  @NoTenant()
  @Post('switch-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aktif hesabi degistir → yeni access+refresh cifti' })
  async switchAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: SwitchAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.switchAccount(user.userId, dto.membershipId, this.meta(req));
    this.setCookies(res, result.tokens);
    return result;
  }

  // ---------------------------------------------------------------- 2FA kurulumu (§11.1)

  @NoTenant()
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA kurulumunu baslat → aday secret + QR (otpauth) URL' })
  twoFactorSetup(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorSetupDto) {
    return this.auth.startTwoFactorSetup(user.userId, dto.password);
  }

  @NoTenant()
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA kurulumunu tamamla → tek seferlik yedek kurtarma kodlari' })
  twoFactorEnable(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorEnableDto) {
    return this.auth.enableTwoFactor(user.userId, dto.totp);
  }

  @NoTenant()
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA kapat (parola + gecerli kod)' })
  twoFactorDisable(@CurrentUser() user: RequestUser, @Body() dto: TwoFactorDisableDto) {
    return this.auth.disableTwoFactor(user.userId, dto.password, dto.totp);
  }

  // ---------------------------------------------------------------- hesap silme (§11.6 KVKK)

  @NoTenant()
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hesabi sil — kimlik anonimlestirilir, finansal kayitlar defterde kalir',
  })
  async deleteAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.deleteAccount(user.userId, dto.password);
    this.clearCookies(res);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sifre sifirlama e-postasi (yanit her zaman ayni)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sifreyi sifirla — tum oturumlar kapanir' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Roles(UserRole.SELLER_ADMIN, UserRole.SELLER_STAFF)
  @Post('invites')
  @ApiOperation({ summary: 'Cari icin davet linki/QR uret (§6.2)' })
  createInvite(@CurrentUser() user: RequestUser, @Body() dto: CreateInviteDto) {
    if (!user.sellerId) throw new AppError(ErrorCode.TENANT_FORBIDDEN);
    return this.auth.createInvite(
      user.sellerId,
      dto.buyerAccountId,
      dto.expiresInHours,
      user.userId,
    );
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Davet/QR ile aktivasyon → giris' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.acceptInvite(dto, this.meta(req));
    this.setCookies(res, result.tokens);
    return result;
  }

  // ---------------------------------------------------------------- yardimcilar

  private meta(req: Request): ClientMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private readRefreshToken(req: Request, dto: RefreshDto): string {
    const token = this.tryReadRefreshToken(req, dto);
    if (!token) throw new AppError(ErrorCode.UNAUTHORIZED);
    return token;
  }

  private tryReadRefreshToken(req: Request, dto: RefreshDto): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return dto.refreshToken ?? cookies?.[REFRESH_COOKIE];
  }

  /** Kural #9: panel tokenlari httpOnly+Secure+SameSite cookie'de tutar; localStorage YASAK. */
  private setCookies(res: Response, tokens: AuthTokens): void {
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const common = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...common,
      maxAge: tokens.expiresIn * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...common,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}
