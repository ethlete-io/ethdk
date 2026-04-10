import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'eslint-plugin',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.js'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/eslint-plugin',
      provider: 'v8',
    },
  },
});
