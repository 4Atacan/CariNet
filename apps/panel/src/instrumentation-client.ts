import * as Sentry from '@sentry/nextjs';

// §11.8 — Panel istemci tarafi Sentry. DSN yoksa no-op (kural #8).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}
