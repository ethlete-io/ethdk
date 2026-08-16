import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  { ignores: ['test-results', 'playwright-report'] },
  ...baseConfig,
  playwright.configs['flat/recommended'],
];
