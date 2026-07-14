import type { DocumentType, ImportTarget, MoneyString, TransactionType } from '@carinet/shared';

/** API yanit tipleri — sunucu DTO'lariyla birebir (§10). */

export interface AccountBalance {
  totalDebit: MoneyString;
  totalCredit: MoneyString;
  balance: MoneyString;
  currencyCode: string;
}

export interface Representative {
  id: string;
  fullName: string;
  phone: string | null;
  email?: string | null;
  buyerAccountCount?: number;
}

export interface Buyer {
  id: string;
  accountCode: string;
  title: string;
  vknTckn: string | null;
  creditLimit: MoneyString;
  isActive: boolean;
  representative: Pick<Representative, 'id' | 'fullName' | 'phone'> | null;
  createdAt: string;
}

export interface BuyerWithBalance extends Buyer {
  balance: AccountBalance;
}

export interface BuyerDetail extends BuyerWithBalance {
  userCount: number;
  transactionCount: number;
}

export interface StatementLine {
  id: string;
  type: TransactionType;
  documentType: DocumentType;
  documentNo: string | null;
  documentDate: string;
  dueDate: string | null;
  amount: MoneyString;
  currencyCode: string;
  exchangeRate: MoneyString;
  amountTry: MoneyString;
  description: string | null;
  invoiceId: string | null;
  runningBalance: MoneyString;
}

export interface Transaction {
  id: string;
  buyerAccountId: string;
  buyerAccount: { id: string; accountCode: string; title: string };
  type: TransactionType;
  documentType: DocumentType;
  documentNo: string | null;
  documentDate: string;
  dueDate: string | null;
  amount: MoneyString;
  currencyCode: string;
  exchangeRate: MoneyString;
  description: string | null;
  invoiceId: string | null;
  isCancelled: boolean;
}

export interface InvoiceSummary {
  id: string;
  buyerAccountId: string;
  buyerAccount: { id: string; accountCode: string; title: string };
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  exchangeRate: MoneyString;
  netTotal: MoneyString;
  taxTotal: MoneyString;
  grandTotal: MoneyString;
  isCancelled: boolean;
  itemCount?: number;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: {
    id: string;
    lineNo: number;
    name: string;
    unit: string;
    quantity: string;
    unitPrice: MoneyString;
    taxRate: string;
    netTotal: MoneyString;
    taxAmount: MoneyString;
    lineTotal: MoneyString;
    exchangeRate: MoneyString;
  }[];
}

export interface Address {
  id: string;
  buyerAccountId: string;
  label: string;
  fullAddress: string;
  city: string;
}

export type AgingBucket = 'NOT_DUE' | 'D0_30' | 'D31_60' | 'D61_90' | 'D90_PLUS';

export interface RiskDetail {
  buyerAccountId: string;
  accountCode: string;
  title: string;
  creditLimit: MoneyString;
  balance: MoneyString;
  overdue: MoneyString;
  notDue: MoneyString;
  buckets: Record<AgingBucket, MoneyString>;
  limitUsagePercent: number | null;
  averageDueDate: string | null;
  averageOverdueDays: number;
  openItems: {
    id: string;
    remaining: MoneyString;
    dueDate: string | null;
    documentDate: string;
    overdueDays: number;
    bucket: AgingBucket;
  }[];
}

// ---------------------------------------------------------------- tahsilat (§8)

export type IntentStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
export type CollectChannel = 'BANK_TRANSFER' | 'CARD_POS';

export interface CollectIntent {
  id: string;
  buyerAccountId: string | null;
  buyerAccount: { id: string; accountCode: string; title: string } | null;
  amount: MoneyString;
  currencyCode: string;
  channel: CollectChannel;
  status: IntentStatus;
  referenceCode: string;
  installmentCount: number | null;
  providerRef: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  iban: string;
  holderName: string;
  isActive: boolean;
}

export interface PosConfig {
  id: string;
  provider: string;
  merchantId: string;
  apiKeyMasked: string;
  secretMasked: string;
  isActive: boolean;
  updatedAt: string;
}

export interface StatementRow {
  id: string;
  rowNo: number;
  txDate: string;
  description: string;
  amount: MoneyString;
  matchedIntentId: string | null;
}

export interface StatementMatch {
  rowId: string;
  confidence: 'EXACT' | 'SUGGESTED' | 'NONE';
  intentId: string | null;
  buyerAccountId: string | null;
  buyerAccountLabel: string | null;
  amountMatches: boolean;
  difference: MoneyString | null;
  partial: boolean;
  reason: string;
}

export interface StatementImport {
  batchId: string;
  fileName: string | null;
  rows: StatementRow[];
  matches: StatementMatch[];
  pendingIntentCount: number;
  skippedOutgoing?: number;
  errors?: { rowNo: number; error: string }[];
}

export interface BulkConfirmResult {
  batchId: string;
  confirmed: number;
  results: {
    rowId: string;
    status: 'CONFIRMED' | 'ALREADY_MATCHED' | 'FAILED';
    intentId?: string;
    remainderIntentId?: string | null;
    error?: string;
  }[];
}

// ---------------------------------------------------------------- katalog / iletisim (Faz 4)

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: MoneyString | null;
  currencyCode: string;
  imageUrl: string | null;
  isActive: boolean;
  quantity: string;
  stockUpdatedAt: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export type RequestType = 'SUGGESTION' | 'COMPLAINT' | 'RECONCILIATION_OBJECTION' | 'OTHER';
export type RequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportRequest {
  id: string;
  buyerAccountId: string;
  buyerAccount: { id: string; accountCode: string; title: string } | null;
  type: RequestType;
  subject: string;
  body: string;
  status: RequestStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface ExchangeRate {
  date: string;
  currencyCode: string;
  rate: MoneyString;
}

export interface ImportTotals {
  rowCount: number;
  validCount: number;
  errorCount: number;
  totalDebit?: MoneyString;
  totalCredit?: MoneyString;
  net?: MoneyString;
  createdTransactions?: number;
  createdAccounts?: number;
  createdInvoices?: number;
  skippedInvoices?: number;
}

export interface ImportRow {
  rowNo: number;
  raw: unknown;
  parsed: unknown;
  status: 'PENDING' | 'VALID' | 'ERROR' | 'COMMITTED';
  error: string | null;
}

export interface ImportPreview {
  batchId: string;
  target: ImportTarget;
  mapping?: Record<string, string>;
  totals: ImportTotals;
  duplicateOfBatchId: string | null;
  preview: ImportRow[];
  errors: ImportRow[];
}

export interface ValidationReport {
  batchId: string;
  target: ImportTarget;
  rowCount: number;
  validCount: number;
  errorCount: number;
  newAccounts: number;
  existingAccounts: number;
  importedTotal: MoneyString;
  expectedTotal: MoneyString | null;
  difference: MoneyString | null;
  matches: boolean;
  lines: { rowNo: number; accountCode: string; exists: boolean; type: string; amount: string }[];
}

export interface ImportBatch {
  id: string;
  sourceType: string;
  target: ImportTarget;
  fileName: string | null;
  status: string;
  totals: ImportTotals | null;
  createdAt: string;
  rowCount: number;
}
