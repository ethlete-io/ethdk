import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { heapLinesOf, loadReportOf, vmstatSamplesOf } from './ci-load-report.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

test('reads the vmstat samples after the since-boot row', () => {
  const samples = vmstatSamplesOf(fixture('vmstat-tank.log'));

  assert.equal(samples.length, 2);
  assert.deepEqual(
    samples.map(({ r, us, sy, st }) => ({ r, us, sy, st })),
    [
      { r: 21, us: 56, sy: 12, st: 0 },
      { r: 38, us: 66, sy: 13, st: 0 },
    ],
  );
});

test('reads the heap of each spec file vitest logged', () => {
  const heaps = heapLinesOf(fixture('vitest-heap-usage.log'));

  assert.ok(heaps.length > 0);
  assert.ok(heaps.every(({ file, mb }) => /^bracket:src\/.+\.spec\.ts$/.test(file) && mb > 0));
});

test('counts the samples whose run queue is above the cores', () => {
  const [peak, minute] = loadReportOf({ vmstat: fixture('vmstat-tank.log'), unitLog: '', cores: 32 });

  assert.match(peak, /^2 samples; run queue above 32 cores in 1; peak r 38, st 0%/);
  assert.match(minute, /^min 1: r 38, cpu 79%, st 0%/);
});

test('says so when there are no samples and no heap lines', () => {
  assert.deepEqual(loadReportOf({ vmstat: '', unitLog: '', cores: 4 }), ['no vmstat samples', 'heap: no heap lines']);
});
