import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// e2e testleri GERCEK Postgres'e ihtiyac duyar (docker compose up -d).
// globalSetup semayi uygular + 2 saticili seed'i kurar; cross-tenant matrisi burada kanitlanir (kural #3).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup/env.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    root: '.',
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
});
