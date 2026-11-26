import ethlete from '@ethlete/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['dist'] },
  ...baseConfig,
  {
    ...ethlete.configs.recommendedTs,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      ...ethlete.configs.recommendedTs.rules,
      // The extension is plain TypeScript on the editor's Node host — the @angular-eslint plugin is
      // not loaded here, so its rules have to be switched off rather than left dangling.
      '@angular-eslint/no-output-on-prefix': 'off',
      '@angular-eslint/no-output-native': 'off',
      // The two rules below steer asynchronous work towards RxJS, which is right everywhere the SDK
      // runs and wrong here: VS Code's API is promise-based, there is no injection context for
      // `takeUntilDestroyed`, and adding RxJS to satisfy them would put a library in the bundle that
      // the extension has no other use for.
      'ethlete/no-async-await': 'off',
      'ethlete/prefer-rxjs-timer': 'off',
    },
  },
  ethlete.configs.recommendedSpec,
];
