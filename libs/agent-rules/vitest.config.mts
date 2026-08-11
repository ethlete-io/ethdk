import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'agent-rules',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/agent-rules',
      provider: 'v8',
    },
  },
});
