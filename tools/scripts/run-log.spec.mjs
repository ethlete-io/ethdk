import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { markRunLogFailed, startRunLog } from './run-log.mjs';

const quiet = () => {};
const tick = () => new Promise((done) => setTimeout(done, 3));

test('logs of a longer stem do not evict the logs of a shorter stem sharing its prefix', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-log-stem-'));
  for (let at = 0; at < 8; at++) {
    startRunLog(join(dir, 'push-suite-e2e-load.log'), quiet);
    await tick();
  }
  const e2e = [];
  for (let at = 0; at < 3; at++) {
    e2e.push(startRunLog(join(dir, 'push-suite-e2e.log'), quiet));
    await tick();
  }

  for (const file of e2e) assert.ok(existsSync(file), file);
  assert.equal(readdirSync(dir).filter((name) => name.startsWith('push-suite-e2e-load-')).length, 5);
  rmSync(dir, { recursive: true });
});

test('a failed run log survives more than five later passing runs and the pointer follows it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-log-failed-'));
  const base = join(dir, 'step.log');
  const failed = markRunLogFailed(startRunLog(base, quiet));
  assert.match(failed, /-failed\.log$/);
  assert.equal(readFileSync(base, 'utf8'), `latest run log: ${failed}\n`);
  for (let at = 0; at < 8; at++) {
    await tick();
    startRunLog(base, quiet);
  }

  assert.ok(existsSync(failed));
  assert.equal(readdirSync(dir).filter((name) => !name.includes('failed') && name !== 'step.log').length, 5);
  rmSync(dir, { recursive: true });
});
