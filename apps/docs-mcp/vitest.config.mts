import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'docs-mcp',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/docs-mcp',
      provider: 'v8',
    },
  },
});
