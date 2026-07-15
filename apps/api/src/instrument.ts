import * as Sentry from '@sentry/node';

/**
 * §11.8 — Sentry hata izleme. YALNIZ `SENTRY_DSN` tanimliysa (prod/staging) devreye girer;
 * tanimli degilse TAM no-op (dev/test etkilenmez, kural #8 — onaysiz harici cagri yok).
 *
 * main.ts'in EN BASINDA import edilir ki Nest boot'undan onceki hatalar da yakalansin.
 * DSN gercek ortam degiskeninden (Coolify secrets) okunur — koda gomulmez (kural #10).
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    // Performans izleme dusuk orandan; hata yakalama tam.
    tracesSampleRate: 0.1,
  });
}

export const sentryEnabled = Boolean(dsn);
