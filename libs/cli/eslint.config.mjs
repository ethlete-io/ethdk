import ethlete from '@ethlete/eslint-plugin';
import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,

  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          // `et design check` resolves these two out of the checkout it draws, or out of this
          // package, so neither shows up as an import.
          ignoredDependencies: ['playwright', 'typescript'],
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/*.spec.ts',
            '{projectRoot}/vitest.config.{js,ts,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  // Ethlete styleguide rules — TypeScript files
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      // `cli` is a Node program, not an Angular library — the @angular-eslint plugin is not
      // loaded here, so its rules must be switched off rather than left dangling.
      '@angular-eslint/no-output-on-prefix': 'off',
      '@angular-eslint/no-output-native': 'off',
      // Same reason: the banned-syntax list is written for Angular library code. A Node release
      // script legitimately awaits child processes and the registry.
      'no-restricted-syntax': 'off',
      'ethlete/no-async-await': 'off',
    },
  },
  // `design/` is browser code Vite serves from source into the frame page. Browser globals are
  // available there; the Angular-library rules about injecting the DOM, CSP and viewport do not apply.
  {
    files: ['design/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-globals': 'off',
      'ethlete/no-csp-unsafe': 'off',
      'ethlete/no-direct-dom-manipulation': 'off',
      'ethlete/no-dom-query': 'off',
      'ethlete/no-window-location': 'off',
      'ethlete/no-native-observers': 'off',
      'ethlete/prefer-viewport-size': 'off',
      'ethlete/prefer-rxjs-timer': 'off',
    },
  },
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
