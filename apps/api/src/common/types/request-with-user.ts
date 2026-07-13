import { type Request } from 'express';
import { type UserRole } from '@carinet/shared';

/** JWT dogrulandiktan sonra request'e yapisan baglam (§6.3). */
export interface RequestUser {
  userId: string;
  membershipId: string | null;
  role: UserRole;
  sellerId: string | null;
  buyerAccountId: string | null;
}

export interface RequestWithUser extends Request {
  user?: RequestUser;
}
