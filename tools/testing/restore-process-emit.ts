import { afterAll } from 'vitest';

/**
 * Workaround: importing `@nx/devkit` loads `nx/dist/src/native`, which wraps `process.emit` in a
 * closure over the spec file's VM context. Vitest 5's `vmThreads` pool drops `process` from that
 * context after the file, so every later `process.emit` in the worker throws
 * "process is not defined". Restoring the original after each file keeps the wrapper scoped to it.
 */
export const restoreProcessEmitAfterEachFile = () => {
  const emit = process.emit;

  afterAll(() => {
    process.emit = emit;
  });
};
