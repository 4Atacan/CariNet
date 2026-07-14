import { Injectable, Logger } from '@nestjs/common';
import { type NotificationType } from '@carinet/shared';

/**
 * §13 Faz 4 — push gonderimi. Expo Push API UCRETSIZDIR (kural #8: ucretli servis yok).
 * https://exp.host/--/api/v2/push/send
 *
 * KRITIK (§6.2): token kullanici+cihaz bazlidir, SATICI bazli degil. Ayni kullanici birden
 * cok saticinin carisinde olabilir → bildirimin hangi hesaba ait oldugu PAYLOAD'da tasinir
 * (`sellerId` + `buyerAccountId`). Mobil, aktif hesap baglamina gore rozet/yonlendirme yapar.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo tek istekte en fazla 100 mesaj kabul eder. */
const BATCH_SIZE = 100;

export interface PushPayload {
  sellerId: string;
  buyerAccountId: string | null;
  type: NotificationType;
  /** Ilgili kaydin id'si (fatura, tahsilat, kampanya) — mobil dogru ekrana gider. */
  entityId?: string;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: PushPayload;
  sound: 'default';
  /** iOS rozeti — hesap bazli okunmamis sayisi (§13 Faz 4). */
  badge?: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Expo "DeviceNotRegistered" derse token silinmeli. */
  invalidTokens: string[];
}

/** Expo'nun yanit bicimi (dis sinir → dar tipleme). */
interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; expoPushToken?: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /** Gecerli Expo token bicimi. Bozuk token Expo'ya hic gonderilmez. */
  static isExpoToken(token: string): boolean {
    return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
  }

  buildMessage(
    token: string,
    title: string,
    body: string,
    payload: PushPayload,
    badge?: number,
  ): PushMessage {
    return { to: token, title, body, data: payload, sound: 'default', ...(badge ? { badge } : {}) };
  }

  /**
   * Gonderim BEST-EFFORT'tur: push basarisiz olsa bile bildirim zaten DB'ye yazilmistir
   * (bildirim merkezi calisir). Bu yuzden hata firlatmaz, sonucu raporlar.
   */
  async send(messages: readonly PushMessage[]): Promise<PushResult> {
    const valid = messages.filter((m) => PushService.isExpoToken(m.to));
    const result: PushResult = {
      sent: 0,
      failed: messages.length - valid.length,
      invalidTokens: [],
    };
    if (valid.length === 0) return result;

    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          this.logger.warn({ status: response.status }, 'Expo push istegi reddedildi');
          result.failed += batch.length;
          continue;
        }

        const json = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = json.data ?? [];

        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            result.sent += 1;
            return;
          }
          result.failed += 1;
          // Cihaz uygulamayi silmis/token gecersiz → token temizlenir, bir daha denenmez.
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const dead = ticket.details.expoPushToken ?? batch[index]?.to;
            if (dead) result.invalidTokens.push(dead);
          }
        });
      } catch (error) {
        // Ag hatasi bildirimi dusurmez: DB kaydi durur, kullanici uygulamayi acinca gorur.
        this.logger.warn({ err: error }, 'Expo push gonderilemedi (bildirim DB"de duruyor)');
        result.failed += batch.length;
      }
    }

    return result;
  }
}
