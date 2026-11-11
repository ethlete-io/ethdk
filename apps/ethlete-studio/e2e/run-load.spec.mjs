import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalLineOf, cpuDeltaOf, cpuTicksOf, psRowsOf, runLoadLineOf, topProcessLinesOf } from './run-load.mjs';

test('a run under the core count is a measurement and names machine, cores and workers', () => {
  assert.equal(
    runLoadLineOf({ start: 3.14, end: 7.9, cores: 8, workers: 4, machine: 'pc' }),
    'load 3.1 at start, 7.9 at end on pc, 8 cores, 4 worker(s)',
  );
});

test('a run above the core count at its start or its end is noisy', () => {
  assert.match(
    runLoadLineOf({ start: 39, end: 2, cores: 32, workers: 8, machine: 'pc' }),
    / - noisy, not a measurement$/,
  );
  assert.match(
    runLoadLineOf({ start: 2, end: 51, cores: 32, workers: 8, machine: 'pc' }),
    / - noisy, not a measurement$/,
  );
});

test('the top processes come highest CPU first, at most five, with their checkout', () => {
  const processes = [1, 2, 3, 4, 5, 6].map((pid) => ({ pid, cpu: pid * 10, command: `p${pid}`, cwd: `/c/${pid}` }));
  const lines = topProcessLinesOf([...processes, { pid: 7, cpu: 5, command: 'gone', cwd: null }]);

  assert.equal(lines.length, 5);
  assert.equal(lines[0], '   60.0 % cpu  6  p6  in /c/6');
  assert.equal(lines[4], '   20.0 % cpu  2  p2  in /c/2');
  assert.equal(topProcessLinesOf([{ pid: 7, cpu: 5, command: 'gone', cwd: null }])[0], '    5.0 % cpu  7  gone  in ?');
});

test('ps output parses into rows, a command with spaces kept whole', () => {
  assert.deepEqual(psRowsOf('  12  3.5 node\n 345 80.0 Google Chrome Helper\n\n'), [
    { pid: 12, cpu: 3.5, command: 'node' },
    { pid: 345, cpu: 80, command: 'Google Chrome Helper' },
  ]);
});

test('the CPU ticks of a stat line sum user and system time, a command with spaces and parens kept apart', () => {
  assert.equal(cpuTicksOf('42 (node (x) y) S 1 42 42 0 -1 4194560 100 0 0 0 250 50 0 0 20 0 1 0'), 300);
});

test('an idle process with a high lifetime average does not appear in the one-second sample', () => {
  const before = new Map([
    [1, 90000],
    [2, 500],
  ]);
  const after = new Map([
    [1, 90000],
    [2, 580],
    [3, 10],
  ]);

  assert.deepEqual([...cpuDeltaOf({ before, after, seconds: 1, ticksPerSecond: 100 })], [[2, 80]]);
});

test('the 90 s goal counts on the goal machine and is only reported elsewhere', () => {
  assert.equal(goalLineOf({ ms: 84_400, machine: 'tank', noisy: false }), 'goal: 84 s on tank, within the 90 s goal');
  assert.equal(goalLineOf({ ms: 117_000, machine: 'tank', noisy: false }), 'goal: 117 s on tank, over the 90 s goal');
  assert.equal(
    goalLineOf({ ms: 117_000, machine: 'tank', noisy: true }),
    'goal: 117 s on tank, noisy, not a measurement of the 90 s goal',
  );
  assert.equal(
    goalLineOf({ ms: 450_000, machine: 'mac', noisy: false }),
    'goal: 450 s on mac, reported only (the 90 s goal counts on tank)',
  );
  assert.equal(
    goalLineOf({ ms: 80_000, machine: 'mac', noisy: false, goalMachine: 'mac' }),
    'goal: 80 s on mac, within the 90 s goal',
  );
});
