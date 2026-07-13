import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// NestJS dekorator metadata'si icin SWC gerekir (esbuild emitDecoratorMetadata desteklemez).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    root: '.',
  },
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
});
