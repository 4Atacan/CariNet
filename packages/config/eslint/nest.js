import tseslint from 'typescript-eslint';
import { base } from './base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export const nest = tseslint.config(...base, {
  files: ['**/*.ts'],
  rules: {
    /**
     * NestJS DI, enjekte edilen siniflari `design:paramtypes` metadata'sindan cozer.
     * `import type`e cevrilirse import runtime'da silinir ve DI COKER.
     * Bu yuzden Nest paketinde kural kapali (base'de acik kalir).
     */
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
  },
});

export default nest;
