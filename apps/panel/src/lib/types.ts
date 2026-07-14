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
