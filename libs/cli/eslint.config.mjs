import ethlete from '@ethlete/eslint-plugin';
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
    },
  },
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
