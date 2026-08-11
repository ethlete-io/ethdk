import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'timetrack',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/timetrack',
      provider: 'v8',
    },
  },
});
