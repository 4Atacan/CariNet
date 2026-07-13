import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { type Env } from '../../config/env';

/** Lokal: Mailpit (localhost:1025, UI :8025). Prod: Resend (Faz 5). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.from = this.config.get('MAIL_FROM', { infer: true });
    this.transporter = createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: false,
      ignoreTLS: true,
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
      // Mail gonderilemezse akis kirilmaz; §11.8 uyarinca loglanir.
      this.logger.error(`E-posta gonderilemedi (${subject})`, error as Error);
    }
  }
}
