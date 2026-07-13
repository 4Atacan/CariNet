import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';

/** nestjs-zod'un bekledigi sinif tipi (swagger'in ic tipi disari acilmiyor). */
type SchemaObjectFactoryClass = NonNullable<Parameters<typeof patchNestJsSwagger>[0]>;

/**
 * §14: "Swagger guncellenmeden endpoint degisikligi yok" → semalar Zod'dan URETILIR.
 *
 * nestjs-zod'un patchNestJsSwagger()'i @nestjs/swagger'in ic sinifi SchemaObjectFactory'yi
 * `require('@nestjs/swagger/dist/services/schema-object-factory')` ile arar; @nestjs/swagger 11'in
 * `exports` haritasi bu alt yolu KAPATTIGI icin cagri ERR_PACKAGE_PATH_NOT_EXPORTED verir.
 * Sinifi paket dizininden MUTLAK yolla yukleyip fonksiyona elle geciriyoruz (exports haritasi
 * mutlak yol require'inda devreye girmez). Swagger 12'de bu koprü gozden gecirilmeli.
 */
function loadSchemaObjectFactory(): SchemaObjectFactoryClass {
  const req = createRequire(__filename);
  const swaggerRoot = dirname(req.resolve('@nestjs/swagger/package.json'));
  const mod = req(join(swaggerRoot, 'dist', 'services', 'schema-object-factory.js')) as {
    SchemaObjectFactory: SchemaObjectFactoryClass;
  };
  return mod.SchemaObjectFactory;
}

export function setupSwagger(app: INestApplication): void {
  patchNestJsSwagger(loadSchemaObjectFactory());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CariNet API')
      .setDescription('B2B cari hesap platformu — §10 API sozlesmesi')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('docs', app, document);
}
