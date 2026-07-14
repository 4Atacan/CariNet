import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiDelete, apiPost } from './api';

/**
 * §13 Faz 4 — push kaydi.
 *
 * KRITIK (§6.2): token KULLANICI+CIHAZ bazlidir, satici bazli DEGIL. Ayni kullanici birden
 * cok saticinin carisinde olabilir; bildirimin hangi hesaba ait oldugu PAYLOAD'da gelir
 * (sellerId + buyerAccountId). Hesap degistirince token yeniden kaydedilmez — payload zaten
 * dogru hesabi tasir.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushPayload {
  sellerId: string;
  buyerAccountId: string | null;
  type: string;
  entityId?: string;
}

let registeredToken: string | null = null;

/** Girişten sonra cagrilir. Izin verilmezse SESSIZCE gecer — uygulama calismaya devam eder. */
export async function registerForPush(): Promise<string | null> {
  // Simulatorde push yoktur; gercek cihaz sart.
  if (!Device.isDevice) return null;

  let granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  // Izin verilmezse SESSIZCE gec: bildirim merkezi (uygulama ici) yine calisir.
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bildirimler',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await apiPost('/notifications/tokens', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: Device.deviceName ?? undefined,
    });
    registeredToken = token;
    return token;
  } catch {
    // Push kaydi basarisiz olsa bile bildirim MERKEZI calisir (kayitlar API'de).
    return null;
  }
}

/** Cikista: baska bir hesap bu cihazda bizim bildirimlerimizi almasin. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await apiDelete(`/notifications/tokens/${encodeURIComponent(registeredToken)}`);
  } catch {
    // Cikis akisini bloklamaz.
  }
  registeredToken = null;
}
