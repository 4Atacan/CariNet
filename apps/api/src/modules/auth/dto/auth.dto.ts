import { createZodDto } from 'nestjs-zod';
import {
  acceptInviteSchema,
  changePasswordSchema,
  completeSellerInviteSchema,
  createInviteSchema,
  createSellerInviteSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  startSellerInviteSchema,
  resetPasswordSchema,
  switchAccountSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorSetupSchema,
} from '@carinet/shared';

/** Sinirdaki tek dogruluk kaynagi packages/shared'daki Zod semalari (kural #7).
 *  createZodDto ayni semayi Swagger'a da tasir → §14 "Swagger guncellenmeden endpoint yok". */

export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}
export class SwitchAccountDto extends createZodDto(switchAccountSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class CreateInviteDto extends createZodDto(createInviteSchema) {}
export class AcceptInviteDto extends createZodDto(acceptInviteSchema) {}
export class CreateSellerInviteDto extends createZodDto(createSellerInviteSchema) {}
export class StartSellerInviteDto extends createZodDto(startSellerInviteSchema) {}
export class CompleteSellerInviteDto extends createZodDto(completeSellerInviteSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class TwoFactorSetupDto extends createZodDto(twoFactorSetupSchema) {}
export class TwoFactorEnableDto extends createZodDto(twoFactorEnableSchema) {}
export class TwoFactorDisableDto extends createZodDto(twoFactorDisableSchema) {}
export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
