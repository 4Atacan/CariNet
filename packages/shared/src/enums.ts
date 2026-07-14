import { z } from 'zod';

/** CLAUDE.md §7 — tek dogruluk kaynagi. Prisma enumlari bunlarla birebir ayni olmali. */

export const TransactionType = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
export const transactionTypeSchema = z.nativeEnum(TransactionType);

export const DocumentType = {
  SALES_INVOICE: 'SALES_INVOICE',
  PAYMENT: 'PAYMENT',
  TRANSFER_RECEIPT: 'TRANSFER_RECEIPT',
  REFUND: 'REFUND',
  OPENING_BALANCE: 'OPENING_BALANCE',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
export const documentTypeSchema = z.nativeEnum(DocumentType);

export const UserRole = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SELLER_ADMIN: 'SELLER_ADMIN',
  SELLER_STAFF: 'SELLER_STAFF',
  BUYER_USER: 'BUYER_USER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const userRoleSchema = z.nativeEnum(UserRole);

export const IntentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type IntentStatus = (typeof IntentStatus)[keyof typeof IntentStatus];
export const intentStatusSchema = z.nativeEnum(IntentStatus);

export const CollectChannel = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD_POS: 'CARD_POS',
} as const;
export type CollectChannel = (typeof CollectChannel)[keyof typeof CollectChannel];
export const collectChannelSchema = z.nativeEnum(CollectChannel);

/** Satici personeli rolleri (seller_members.role) */
export const SellerMemberRole = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
} as const;
export type SellerMemberRole = (typeof SellerMemberRole)[keyof typeof SellerMemberRole];
export const sellerMemberRoleSchema = z.nativeEnum(SellerMemberRole);

/** import_batches.source_type */
export const ImportSourceType = {
  EXCEL_GENERIC: 'EXCEL_GENERIC',
  PRESET_LOGO: 'PRESET_LOGO',
  PRESET_MIKRO: 'PRESET_MIKRO',
  PRESET_NETSIS: 'PRESET_NETSIS',
  PRESET_ETA: 'PRESET_ETA',
  UBL_XML: 'UBL_XML',
  WIZARD: 'WIZARD',
  BANK_STATEMENT: 'BANK_STATEMENT',
} as const;
export type ImportSourceType = (typeof ImportSourceType)[keyof typeof ImportSourceType];
export const importSourceTypeSchema = z.nativeEnum(ImportSourceType);

/** import_batches.target — ayni dosya bicimi farkli tablolara yazilabilir (§9). */
export const ImportTarget = {
  BUYER_ACCOUNTS: 'BUYER_ACCOUNTS',
  TRANSACTIONS: 'TRANSACTIONS',
  OPENING_BALANCES: 'OPENING_BALANCES',
  INVOICES: 'INVOICES',
  BANK_STATEMENT: 'BANK_STATEMENT',
} as const;
export type ImportTarget = (typeof ImportTarget)[keyof typeof ImportTarget];
export const importTargetSchema = z.nativeEnum(ImportTarget);

export const ImportStatus = {
  PENDING: 'PENDING',
  PARSED: 'PARSED',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];
export const importStatusSchema = z.nativeEnum(ImportStatus);

export const ImportRowStatus = {
  PENDING: 'PENDING',
  VALID: 'VALID',
  ERROR: 'ERROR',
  COMMITTED: 'COMMITTED',
} as const;
export type ImportRowStatus = (typeof ImportRowStatus)[keyof typeof ImportRowStatus];
export const importRowStatusSchema = z.nativeEnum(ImportRowStatus);

export const NotificationType = {
  NEW_INVOICE: 'NEW_INVOICE',
  DUE_REMINDER: 'DUE_REMINDER',
  COLLECTION_CONFIRMED: 'COLLECTION_CONFIRMED',
  CAMPAIGN: 'CAMPAIGN',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
export const notificationTypeSchema = z.nativeEnum(NotificationType);

/** Talep-Oneri (§13 Faz 4). Devir mutabakatina itiraz da buradan akar (§9). */
export const RequestType = {
  SUGGESTION: 'SUGGESTION',
  COMPLAINT: 'COMPLAINT',
  RECONCILIATION_OBJECTION: 'RECONCILIATION_OBJECTION',
  OTHER: 'OTHER',
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];
export const requestTypeSchema = z.nativeEnum(RequestType);

export const RequestStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];
export const requestStatusSchema = z.nativeEnum(RequestStatus);
