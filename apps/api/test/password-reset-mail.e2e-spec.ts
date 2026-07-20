import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { USERS, createTestApp, rawPrisma } from './setup/test-app';

/**
 * §11.1 — "Sifremi unuttum" akisinin GERCEKTEN posta urettigini dogrular.
 *
 * Neden onemli: uc her zaman `{ok:true}` doner (e-posta kayitli mi sizdirilmez), dolayisiyla
 * HTTP yaniti postanin gidip gitmedigi hakkinda HICBIR SEY soylemez. Prod'da SMTP
 * yapilandirilmamisken uc "basarili" donuyordu ve kimse fark etmiyordu. Burada Mailpit'in
 * gelen kutusu okunarak mesajin varligi ve icindeki baglanti dogrulanir.
 */
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

const inbox = async (): Promise<MailpitMessage[]> => {
  const res = await fetch(`${MAILPIT}/api/v1/messages`);
  return ((await res.json()) as { messages: MailpitMessage[] }).messages;
};

describe('Sifre sifirlama e-postasi (e2e §11.1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }); // kutuyu temizle
  });

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  it('kayitli e-posta icin sifirlama postasi URETILIR ve baglanti icerir', async () => {
    await http().post('/v1/auth/forgot-password').send({ email: USERS.seller1Admin }).expect(200);

    // Gonderim asenkron degil ama SMTP tur atisi icin kisa bir pay birakilir.
    let messages: MailpitMessage[] = [];
    for (let i = 0; i < 20 && messages.length === 0; i++) {
      messages = await inbox();
      if (messages.length === 0) await new Promise((r) => setTimeout(r, 250));
    }

    expect(messages).toHaveLength(1);
    expect(messages[0]!.To[0]!.Address).toBe(USERS.seller1Admin);
    expect(messages[0]!.Subject).toContain('Sifre sifirlama');

    const body = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json();
    expect((body as { Text: string }).Text).toContain('/sifre-sifirla?token=');
  });

  it('KAYITSIZ e-postada posta uretilmez ama yanit AYNI kalir (§11.1)', async () => {
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

    const res = await http()
      .post('/v1/auth/forgot-password')
      .send({ email: 'boyle-biri-yok@carinet.local' })
      .expect(200);

    // Yanit kayitli e-postadakiyle ayni olmali — kullanici var/yok sizdirilmaz.
    expect(res.body.success).toBe(true);
    await new Promise((r) => setTimeout(r, 750));
    expect(await inbox()).toHaveLength(0);
  });
});
