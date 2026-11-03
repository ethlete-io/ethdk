import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { waitForLock } from './commit-wait.mjs';

test('waits while the lock exists, reports it and never deletes it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'commit-wait-'));
  const lock = join(dir, 'index.lock');
  writeFileSync(lock, '');
  const logs = [];
  setTimeout(() => assert.ok(existsSync(lock)), 50);
  setTimeout(() => rmSync(lock), 200);
  const started = Date.now();
  await waitForLock(lock, { intervalMs: 20, reportMs: 60, log: (line) => logs.push(line) });
  assert.ok(Date.now() - started >= 150);
  assert.ok(logs.length >= 2);
  assert.match(logs[0], /^waiting for lock held since \d{4}-/);
  rmSync(dir, { recursive: true });
});

test('returns at once without a lock', async () => {
  const started = Date.now();
  await waitForLock(join(tmpdir(), 'commit-wait-none.lock'), { intervalMs: 1000 });
  assert.ok(Date.now() - started < 500);
});
