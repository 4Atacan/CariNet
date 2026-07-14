import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { tokenStore } from './api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

/**
 * Ekstre PDF'ini indirir ve sistem paylasim sayfasini acar (§13 Faz 2 "PDF + paylas").
 * PDF zarf DISINDA ham ikili doner; access token Authorization basliginda gider (kural #9).
 */
export async function shareStatementPdf(accountCode: string): Promise<void> {
  const token = await tokenStore.getAccess();
  const target = `${FileSystem.cacheDirectory}ekstre-${accountCode}.pdf`;

  const result = await FileSystem.downloadAsync(`${BASE_URL}/reports/statement-pdf/me`, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status !== 200) {
    throw new Error('Ekstre olusturulamadi');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf' });
  }
}
