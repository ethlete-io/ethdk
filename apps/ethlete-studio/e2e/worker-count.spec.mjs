import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workerCountOf } from './worker-count.mjs';

test('a local run without a flag or env starts at most 2 workers', () => {
  assert.equal(workerCountOf({ args: [], env: {}, cores: 32 }), 2);
  assert.equal(workerCountOf({ args: [], env: {}, cores: 4 }), 1);
});

test('CI keeps the core-based default', () => {
  assert.equal(workerCountOf({ args: [], env: { CI: 'true' }, cores: 32 }), 8);
});

test('--workers and STUDIO_E2E_WORKERS win over the default', () => {
  assert.equal(workerCountOf({ args: ['--workers', '5'], env: {}, cores: 32 }), 5);
  assert.equal(workerCountOf({ args: [], env: { STUDIO_E2E_WORKERS: '3' }, cores: 32 }), 3);
  assert.equal(workerCountOf({ args: ['--workers', '1'], env: { CI: 'true', STUDIO_E2E_WORKERS: '4' }, cores: 32 }), 1);
});
