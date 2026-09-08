import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: 'timetrack',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'testing/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/timetrack',
      provider: 'v8',
    },
  },
});
