import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { dutySlices, throttle } from './cpu-throttle.mjs';

const run = promisify(execFile);

test('a CPU share splits each period into a run slice and a stop slice', () => {
  assert.deepEqual(dutySlices(20), { runMs: 20, stopMs: 80 });
  assert.deepEqual(dutySlices(100), { runMs: 100, stopMs: 0 });
  assert.throws(() => dutySlices(0), /in \(0, 100\]/);
});

test('the throttle returns the exit code of the command', async () => {
  assert.equal(await throttle(50, process.execPath, ['-e', 'process.exit(3)']), 3);
});

const shareVerdict = ({ freeMs, throttledMs, wallMs }) =>
  freeMs < wallMs * 0.4
    ? `skip: the machine is too loaded to measure a 10 % share (the free run got ${Math.round((freeMs / wallMs) * 100)} % of a core)`
    : throttledMs < freeMs * 0.5;

test('a share check under a load that starves the free run skips instead of failing', () => {
  assert.match(String(shareVerdict({ freeMs: 300, throttledMs: 180, wallMs: 1500 })), /^skip: .* got 20 % of a core/);
  assert.equal(shareVerdict({ freeMs: 1500, throttledMs: 160, wallMs: 1500 }), true);
  assert.equal(shareVerdict({ freeMs: 1500, throttledMs: 900, wallMs: 1500 }), false);
});

test('a throttled busy loop gets about its share of the CPU time', async (t) => {
  const wallMs = 1500;
  const busy = `const end = Date.now() + ${wallMs}; while (Date.now() < end); const { user, system } = process.cpuUsage(); console.log((user + system) / 1000);`;
  const script = fileURLToPath(new URL('./cpu-throttle.mjs', import.meta.url));
  const [freeMs, throttledMs] = (
    await Promise.all([
      run(process.execPath, ['-e', busy]),
      run(process.execPath, [script, '10', '--', process.execPath, '-e', busy]),
    ])
  ).map(({ stdout }) => Number(stdout));
  const verdict = shareVerdict({ freeMs, throttledMs, wallMs });

  if (typeof verdict === 'string') return t.skip(verdict);
  assert.ok(verdict, `throttled ${throttledMs} ms vs free ${freeMs} ms of CPU`);
});
