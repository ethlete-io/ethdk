import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { dutySlices, throttle } from './cpu-throttle.mjs';

test('a CPU share splits each period into a run slice and a stop slice', () => {
  assert.deepEqual(dutySlices(20), { runMs: 20, stopMs: 80 });
  assert.deepEqual(dutySlices(100), { runMs: 100, stopMs: 0 });
  assert.throws(() => dutySlices(0), /in \(0, 100\]/);
});

test('the throttle returns the exit code of the command', async () => {
  assert.equal(await throttle(50, process.execPath, ['-e', 'process.exit(3)']), 3);
});

test('a throttled busy loop gets about its share of the wall time', async () => {
  const busy = `const end = Date.now() + 1500; let n = 0; while (Date.now() < end) n++; console.log(n);`;
  const free = Number(execFileSync(process.execPath, ['-e', busy], { encoding: 'utf8' }));
  const script = fileURLToPath(new URL('./cpu-throttle.mjs', import.meta.url));
  const throttled = Number(
    execFileSync(process.execPath, [script, '10', '--', process.execPath, '-e', busy], { encoding: 'utf8' }),
  );

  assert.ok(throttled < free * 0.5, `throttled ${throttled} vs free ${free}`);
});
