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
      // TODO(styleguide): the autofix rewrites `get foo()` into `get public foo()` and narrows
      // members that are part of the published surface. Re-enable once the fixer is safe for
      // accessors, then land the visibility changes as a breaking change.
      'ethlete/template-member-accessibility': 'off',

      // TODO(styleguide): the two offenders are `generateContentfulImageSources` (a published
      // 6-arg helper) and `renderInsertOrAppend`. Collapsing them into an options object is an
      // API change, not a lint fix.
      'max-params': 'off',
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
    },
  },
  // The Contentful GraphQL schema and the rich-text error codes use snake_case keys verbatim.
  {
    files: ['**/gql/**', '**/*.errors.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  // Ethlete styleguide rules — HTML templates
  ethlete.configs.recommendedTemplate,
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
