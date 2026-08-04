import ethlete from '@ethlete/eslint-plugin';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  // Ethlete styleguide rules — TypeScript files
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/test-helpers.ts', '**/testing/**', '**/generators/**'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'et',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'et',
          style: 'kebab-case',
        },
      ],
      // `query` owns polling, retry backoff and cache GC, so it schedules real timers, and it
      // must read `window`/`document` to detect tab visibility and online state.
      'ethlete/prefer-rxjs-timer': 'off',
      'no-restricted-globals': 'off',
      'ethlete/no-angular-router-api': 'off',

      // TODO(styleguide): each of these has a manual backlog too large to land safely in one
      // pass (~450 violations combined, most of them renames or signature changes on published
      // API). Re-enable one rule at a time.
      'max-params': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'no-restricted-syntax': 'off',
      'ethlete/class-constant-property': 'off',
      'ethlete/class-member-order': 'off',
      'ethlete/no-leading-underscore-class-member': 'off',
      'ethlete/no-subscribe-with-body': 'off',
      'ethlete/no-trivial-wrapper-method': 'off',
      'ethlete/require-dollar-suffix': 'off',

      // TODO(styleguide): the autofix rewrites `get foo()` into `get public foo()` and narrows
      // members that are part of the published surface. Re-enable once the fixer is safe for
      // accessors, then land the visibility changes as a breaking change.
      'ethlete/template-member-accessibility': 'off',

      // Match the repo-wide styleguide convention: `_`-prefixed args/vars/caught errors are
      // intentionally unused (e.g. positional params kept for a type-guard signature).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // `requirePureAnnotation` only pays off in publishable source, so it is off in the shipped config.
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/testing/**', '**/generators/**'],
    rules: {
      'ethlete/no-impure-top-level-provider': ['error', { requirePureAnnotation: true }],
    },
  },
  // Ethlete styleguide rules — HTML templates
  ethlete.configs.recommendedTemplate,
  // TODO(styleguide): `legacy/` is the pre-signals query API, kept only until consumers migrate
  // off it. Rewriting it to the current styleguide is not worth it.
  {
    files: ['**/legacy/**'],
    rules: {
      'ethlete/no-pipe-logic': 'off',
      'ethlete/no-native-observers': 'off',
      'ethlete/no-dom-query': 'off',
      'ethlete/no-legacy-angular-decorators': 'off',
      // The devtools overlay renders inside a host app and isolates its SCSS on purpose.
      'ethlete/require-view-encapsulation-none': 'off',
    },
  },
  // Generators are Node/nx tooling scripts (run-once schematics over the TS AST), not shipped
  // library code — non-null assertions on AST nodes / just-populated Maps are idiomatic there.
  {
    files: ['**/generators/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // The styleguide block above skips these folders, which would otherwise fall back to the nx
  // baseline rule and flag the repo-wide `_`-prefix convention for intentionally unused bindings.
  {
    files: ['**/generators/**/*.ts', '**/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ethlete.configs.recommendedTs.rules['@typescript-eslint/no-unused-vars'],
    },
  },
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
