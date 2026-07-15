import * as Sentry from '@sentry/nextjs';

// §11.8 — runtime'a gore sunucu/edge Sentry yapilandirmasini yukler (DSN yoksa hepsi no-op).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
