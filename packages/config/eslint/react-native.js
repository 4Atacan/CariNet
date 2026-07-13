import tseslint from 'typescript-eslint';
import globals from 'globals';
import { base } from './base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export const reactNative = tseslint.config(...base, {
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
  },
});

export default reactNative;
