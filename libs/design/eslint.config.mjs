import ethlete from '@ethlete/eslint-plugin';
import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,

  { ignores: ['src/lib/design/__fixtures__/*/.ethlete/**'] },

  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      // `design` is Node code bundled into the `cli` program — the @angular-eslint plugin is not
      // loaded here, so its rules must be switched off rather than left dangling.
      '@angular-eslint/no-output-on-prefix': 'off',
      '@angular-eslint/no-output-native': 'off',
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
  // An ambient module may not import by relative path, so the declarations name `@design-explore` as a type import.
  {
    files: ['design/web/env.d.ts'],
    rules: { '@nx/enforce-module-boundaries': 'off', 'ethlete/no-type-only-import': 'off' },
  },
  {
    files: ['src/lib/design/system/rules/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: { 'ethlete/no-silent-catch-error': ['error', { tryCatch: true }] },
  },
  ethlete.configs.recommendedSpec,
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)studio-api$',
              importNames: ['openPointsAnswer'],
              message:
                'Import openPointsAnswer from src/lib/design/system/open-points.fixtures: it warms the open-points worker first.',
            },
            {
              regex: '(^|/)open-points-runner$',
              importNames: ['openPointsInWorker'],
              message:
                'Import openPointsInWorker from src/lib/design/system/open-points.fixtures: it warms the open-points worker first.',
            },
          ],
        },
      ],
    },
  },
];
