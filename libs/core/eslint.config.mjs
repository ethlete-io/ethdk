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
          type: ['element', 'attribute'],
          prefix: 'et',
          style: 'kebab-case',
        },
      ],
      '@angular-eslint/no-input-rename': 'off',

      // `core` *is* the abstraction these rules point at: injectRenderer, the WINDOW/DOCUMENT
      // tokens, the signal-based observers, the cookie/SEO/router/viewport utilities. The
      // implementations necessarily touch the raw platform APIs they replace.
      'no-restricted-globals': 'off',
      'ethlete/no-direct-dom-manipulation': 'off',
      'ethlete/no-dom-query': 'off',
      'ethlete/no-native-observers': 'off',
      'ethlete/no-document-cookie': 'off',
      'ethlete/no-angular-seo-services': 'off',
      'ethlete/no-angular-router-api': 'off',
      'ethlete/no-window-location': 'off',
      'ethlete/prefer-rxjs-timer': 'off',
      'ethlete/prefer-match-media': 'off',
      'ethlete/prefer-viewport-size': 'off',
      'ethlete/prefer-element-dimensions': 'off',
      'ethlete/prefer-scroll-state': 'off',

      // TODO(styleguide): the autofix rewrites `get config()` into `get public config()` and
      // narrows members that are part of the published surface. Re-enable once the fixer is
      // safe for accessors, then land the visibility changes as a breaking change.
      'ethlete/template-member-accessibility': 'off',

      // TODO(styleguide): each of these has a manual backlog too large to land safely in one
      // pass (~300 violations combined, most of them renames or signature changes on published
      // API). Re-enable one rule at a time.
      'max-params': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
      'ethlete/class-constant-property': 'off',
      'ethlete/class-member-order': 'off',
      'ethlete/no-inject-chain': 'off',
      'ethlete/no-leading-underscore-class-member': 'off',
      'ethlete/no-member-alias': 'off',
      'ethlete/no-subscribe-with-body': 'off',
      'ethlete/no-trivial-wrapper-method': 'off',
      'ethlete/prefer-linked-signal': 'off',
      'ethlete/prefer-present-tense-output': 'off',
      'ethlete/require-dollar-suffix': 'off',
    },
  },
  // `requirePureAnnotation` only pays off in publishable source, so it is off in the shipped config.
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/generators/**', '**/stories/**'],
    rules: {
      'ethlete/no-impure-top-level-provider': ['error', { requirePureAnnotation: true }],
    },
  },
  // Ethlete styleguide rules — HTML templates
  ethlete.configs.recommendedTemplate,
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
