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
  {
    files: ['**/*.ts'],
    rules: {
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
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
  // Generators are Node/nx tooling scripts (run-once schematics over the TS AST), not shipped
  // library code — non-null assertions on AST nodes / lookup tables are idiomatic there.
  {
    files: ['**/generators/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // This lib is in maintenance mode and does not adopt the styleguide config, so the two nx baseline
  // rules that config replaces are aligned with it by hand: `any` stays a deliberate tool in generic
  // constraints, and intentionally unused bindings follow the repo-wide `_` prefix.
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ethlete.configs.recommendedTs.rules['@typescript-eslint/no-unused-vars'],
    },
  },
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
