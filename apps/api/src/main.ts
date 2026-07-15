import './instrument'; // §11.8 — Sentry EN BASTA (boot oncesi hatalar da yakalansin)
import 'reflect-metadata';
import { timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { type NextFunction, type Request, type Response } from 'express';
import { type Env } from './config/env';
import { setupSwagger } from './config/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // bufferLogs: pino hazir olana kadar loglar tamponlanir → hicbir log kaybolmaz.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // §11.6 — tum loglar pino'dan (redaction'li) gecer
  const config = app.get(ConfigService<Env, true>);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.setGlobalPrefix('v1');
  // §11.2 — Helmet + siki CSP. Swagger UI ile uyumlu (self + inline stil/script), aksi hepsi kisitli.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: isProd ? { maxAge: 15_552_000, includeSubDomains: true, preload: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  // §11.2 CORS allowlist. Prod'da YALNIZ panel origin'i; dev'de Expo web onizlemesi de eklenir.
  const devOrigins = ['http://localhost:8081', 'http://localhost:19006'];
  app.enableCors({
    origin: isProd
      ? [config.get('PANEL_ORIGIN', { infer: true })]
      : [config.get('PANEL_ORIGIN', { infer: true }), ...devOrigins],
    credentials: true,
  });
  app.enableShutdownHooks();

  // §10 / §11.2 — Swagger prod'da AUTH arkasinda. Dev'de serbest; prod'da yalniz kimlik bilgisi
  // tanimliysa (basic auth) acilir, tanimli degilse HIC acilmaz (varsayilan kapali = guvenli).
  const swaggerUser = config.get('SWAGGER_USER', { infer: true });
  const swaggerPass = config.get('SWAGGER_PASSWORD', { infer: true });
  if (!isProd) {
    setupSwagger(app);
  } else if (swaggerUser && swaggerPass) {
    app.use(['/docs', '/docs-json'], basicAuth(swaggerUser, swaggerPass));
    setupSwagger(app);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`CariNet API hazir → http://localhost:${port}/v1`);
}

/** Sabit-zamanli basic auth (§11.2) — /docs'u prod'da korur. Zamanlama sizintisi olmaz. */
function basicAuth(user: string, pass: string) {
  const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      next();
      return;
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="CariNet API Docs"');
    res.status(401).send('Yetkisiz');
  };
}

void bootstrap();
