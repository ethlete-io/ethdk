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
          // `et design check` resolves playwright and typescript out of the checkout it draws, or out of
          // this package, so neither shows up as an import. `@ethlete/design` is compiled into this package, and the
          // rest are imports of that bundled lib.
          ignoredDependencies: [
            'playwright',
            'typescript',
            '@ethlete/design',
            '@angular/compiler',
            '@angular/core',
            '@angular/forms',
            '@angular/platform-browser',
            '@angular/platform-server',
            '@tailwindcss/node',
            '@tailwindcss/postcss',
            'jiti',
            'postcss',
            'postcss-selector-parser',
            'rxjs',
            'vite',
          ],
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/src/**/*.spec.ts',
            '{projectRoot}/src/**/*.fixtures.ts',
            '{projectRoot}/src/**/__fixtures__/**',
            '{projectRoot}/vitest.config.{js,ts,mts}',
            '{projectRoot}/vitest.perf.config.mts',
            '{projectRoot}/vitest.proof.config.mts',
            '{projectRoot}/vitest.dist.config.mts',
            '{projectRoot}/vitest.skip-reporter.mts',
            '{projectRoot}/vitest.global-setup.ts',
            '{projectRoot}/scripts/**/*.spec.mts',
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
  // Relaxed rules for spec files (non-null assertions are common and intentional in tests)
  ethlete.configs.recommendedSpec,
];
