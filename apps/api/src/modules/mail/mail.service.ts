import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { createTransport, type Transporter } from 'nodemailer';
import { type Env } from '../../config/env';

/**
 * Lokal: Mailpit (localhost:1025, UI :8025, kimlik dogrulamasiz).
 * Prod: Resend SMTP (smtp.resend.com:587 — kullanici "resend", parola API anahtari).
 * Saglayici degistirmek gerekmedi; nodemailer ikisini de konusur.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.from = this.config.get('MAIL_FROM', { infer: true });
    const host = this.config.get('SMTP_HOST', { infer: true });
    const port = this.config.get('SMTP_PORT', { infer: true });
    const user = this.config.get('SMTP_USER', { infer: true });
    const password = this.config.get('SMTP_PASSWORD', { infer: true });

    // Prod'da host hala "localhost" ise SMTP yoktur → sifre sifirlama sessizce olur.
    // Bunu calisma aninda degil BOOT'ta bilmek isteriz.
    this.configured = process.env.NODE_ENV !== 'production' || host !== 'localhost';
    if (!this.configured) {
      this.logger.error(
        'SMTP_HOST prod ortaminda hala "localhost" — sifre sifirlama e-postalari GONDERILEMEZ.',
      );
    }

    this.transporter = createTransport({
      host,
      port,
      // 465 = ortu TLS; 587 STARTTLS ile yukseltilir.
      secure: port === 465,
      // Kimlik YALNIZ verilmisse gonderilir: Mailpit auth beklemez, gonderirsek reddeder.
      ...(user && password ? { auth: { user, pass: password } } : { ignoreTLS: true }),
    });
  }

  async sendPasswordReset(to: string, fullName: string, url: string): Promise<void> {
    await this.send(
      to,
      'CariNet — Sifre sifirlama',
      `Merhaba ${fullName},

Sifrenizi sifirlamak icin asagidaki baglantiya tiklayin. Baglanti 1 saat gecerlidir:
${url}

Bu istegi siz yapmadiysaniz bu e-postayi yok sayabilirsiniz.`,
    );
  }

  async sendInvite(to: string, sellerName: string, url: string): Promise<void> {
    await this.send(
      to,
      `CariNet — ${sellerName} sizi davet etti`,
      `${sellerName} cari hesabinizi CariNet uzerinden takip etmeniz icin sizi davet etti:
${url}`,
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      /*
       * Akis KIRILMAZ: §11.1 geregi sifre sifirlama yaniti her zaman aynidir (e-posta kayitli
       * mi sizdirilmaz), dolayisiyla hatayi kullaniciya gosteremeyiz.
       *
       * Ama sessiz de birakilamaz: kullanici "e-postani kontrol et" gorup hicbir sey almazsa
       * ve 2FA zorunluysa (kural #11) hesabina donmenin baska yolu kalmaz. Log YETMEZ —
       * Sentry'ye acikca bildirilir (§11.8), yoksa kimse fark etmez.
       */
      this.logger.error(`E-posta gonderilemedi (${subject})`, error as Error);
      Sentry.captureException(error, {
        tags: { area: 'mail' },
        extra: { subject, configured: this.configured },
      });
    }
  }
}
