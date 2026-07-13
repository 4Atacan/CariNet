import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { type Env } from './config/env';
import { setupSwagger } from './config/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [config.get('PANEL_ORIGIN', { infer: true })], // §11.2 CORS allowlist
    credentials: true,
  });
  app.enableShutdownHooks();

  // Prod'da Swagger auth arkasinda olmali (§10) — basic auth Faz 5'te eklenecek.
  if (!isProd) setupSwagger(app);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`CariNet API hazir → http://localhost:${port}/v1 (docs: /docs)`);
}

void bootstrap();
