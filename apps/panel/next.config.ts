import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@carinet/shared'],
  // §11.2 — siki guvenlik basliklari (CSP Faz 5'te sertlestirilir).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// §11.8 — Sentry sarmalayici. DSN/authToken yoksa kaynak-harita yuklemesini atlar, build kirilmaz.
export default withSentryConfig(config, { silent: true });
