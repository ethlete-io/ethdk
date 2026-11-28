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
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/*.spec.ts',
            '{projectRoot}/src/**/*.fixtures.ts',
            '{projectRoot}/vitest.config.{js,ts,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      '@angular-eslint/no-output-on-prefix': 'off',
      '@angular-eslint/no-output-native': 'off',
      'no-restricted-syntax': 'off',
      'ethlete/no-async-await': 'off',
    },
  },
  ethlete.configs.recommendedSpec,
];
