import * as Sentry from '@sentry/nextjs';

// §11.8 — Panel edge runtime Sentry. DSN yoksa no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}
