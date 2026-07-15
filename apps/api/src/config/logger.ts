import { type Params } from 'nestjs-pino';

/**
 * §11.6 — pino yapilandirmasi + REDACTION. Parola, token, IBAN, kart alanlari loglara ASLA duz
 * yazilmaz (kural #10: sir loglanmaz). Redaction hem HTTP istek/yaniti hem uygulama loglari icin.
 *
 * Test'te log SESSIZ (e2e ciktisini kirletmesin); dev'de pino-pretty; prod'da ham JSON (toplanabilir).
 */
export function loggerOptions(): Params {
  const env = process.env.NODE_ENV ?? 'development';
  const isProd = env === 'production';
  const isTest = env === 'test';

  return {
    pinoHttp: {
      level: isTest ? 'silent' : isProd ? 'info' : 'debug',
      transport:
        isProd || isTest ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
      autoLogging: !isTest,
      // Gizlenecek yollar: hem HTTP baslik/govde hem herhangi bir derinlikteki hassas alan.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.totp',
          'req.body.recoveryCode',
          'req.body.token',
          'req.body.refreshToken',
          'req.body.secret',
          'req.body.apiKey',
          'req.body.iban',
          'res.headers["set-cookie"]',
          '*.password',
          '*.passwordHash',
          '*.totpSecret',
          '*.token',
          '*.refreshToken',
          '*.iban',
          '*.apiKey',
          '*.secret',
          '*.cardNumber',
          '*.pan',
          '*.cvv',
        ],
        censor: '[gizli]',
      },
    },
  };
}
