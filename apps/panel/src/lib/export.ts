import { apiBlob, qs } from './api';

export type ExportTarget = 'BUYERS' | 'TRANSACTIONS' | 'PRODUCTS' | 'RISK';

const FILE_NAMES: Record<ExportTarget, string> = {
  BUYERS: 'cari-hesaplar.xlsx',
  TRANSACTIONS: 'ekstre.xlsx',
  PRODUCTS: 'urunler.xlsx',
  RISK: 'risk-foyu.xlsx',
};

/**
 * Excel disa aktarma. Zarf DISINDA ham ikili doner (§10 istisnasi — PDF ile ayni desen).
 * Hucre icerigi sunucuda CSV injection'a karsi etkisizlestirilir (§11.3).
 */
export async function downloadExcel(
  target: ExportTarget,
  params: { buyerAccountId?: string; from?: string; to?: string } = {},
): Promise<void> {
  const blob = await apiBlob(`/exports${qs({ target, ...params })}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = FILE_NAMES[target];
  link.click();
  URL.revokeObjectURL(url);
}
