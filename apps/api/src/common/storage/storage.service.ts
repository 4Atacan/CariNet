import { createHash } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';

/**
 * §6.6 — yuklenen dosya arsivlenir (lokal MinIO / prod R2), hash ile mukerrer uyarisi verilir.
 * Bucket PRIVATE'tir (§11.2): dosyaya dogrudan URL ile erisilemez.
 * S3 yapilandirilmamissa (lokal, env yok) import calismaya devam eder — yalniz arsivleme atlanir.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {
    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const accessKeyId = this.config.get('S3_ACCESS_KEY', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_KEY', { infer: true });
    this.bucket = this.config.get('S3_BUCKET', { infer: true });

    this.client =
      endpoint && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            endpoint,
            region: 'auto',
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true, // MinIO
          })
        : null;

    if (!this.client) {
      this.logger.warn('S3/MinIO yapilandirilmadi — yuklenen dosyalar arsivlenmeyecek.');
    }
  }

  /** Mukerrer dosya tespiti icin icerik hash'i (§6.6). */
  hash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /** Basarisiz arsivleme import'u COKERTMEZ; kayit yine de islenir, uyari loglanir. */
  async archive(key: string, buffer: Buffer, contentType: string): Promise<string | null> {
    if (!this.client || !this.bucket) return null;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `s3://${this.bucket}/${key}`;
    } catch (error) {
      this.logger.error({ err: error, key }, 'Dosya arsivlenemedi');
      return null;
    }
  }
}
