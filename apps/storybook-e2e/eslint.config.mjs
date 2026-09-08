import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['test-results', 'playwright-report'] },
  ...baseConfig,
  playwright.configs['flat/recommended'],
  {
    rules: {
      'playwright/no-skipped-test': 'off',
      'playwright/expect-expect': ['warn', { assertFunctionPatterns: ['^expect[A-Z]'] }],
    },
  },
  {
    files: ['**/support/**/*.ts'],
    rules: {
      'playwright/no-wait-for-selector': 'off',
      'playwright/no-wait-for-timeout': 'off',
    },
  },
];
