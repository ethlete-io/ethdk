import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { judgeSuiteRun, runSuite } from './e2e-check.mjs';
import { mapChanged } from './e2e-map.mjs';

const fixture = (body) => {
  const file = join(mkdtempSync(join(tmpdir(), 'e2e-check-spec-')), 'suite.e2e.mjs');
  writeFileSync(file, body);
  return file;
};

const run = (body, options = {}) =>
  runSuite(process.cwd(), 'fixture', undefined, { script: fixture(body), ...options });

test('a suite that throws before its first case is red', async () => {
  const result = await run(`throw new Error('fixture crashed');`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'crashed before its first case');
});

test('a suite that runs zero cases is red even when it exits 0', async () => {
  const result = await run(`console.log('\\n0/0 passed'); process.exit(0);`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'ran zero cases');
});

test('a suite with a silent exit 0 is red', async () => {
  assert.equal((await run(`process.exit(0);`)).ok, false);
});

test('a suite with passing cases is green and a failing case is red', async () => {
  assert.equal((await run(`console.log('PASS  a'); console.log('\\n1/1 passed');`)).ok, true);
  const failed = await run(`console.log('FAIL  a'); console.log('\\n0/1 passed'); process.exit(1);`);
  assert.equal(failed.reason, 'failed');
});

test('a running suite prints a progress line', async () => {
  const lines = [];
  await run(`console.log('PASS  a'); await new Promise((r) => setTimeout(r, 400)); console.log('\\n1/1 passed');`, {
    heartbeatMs: 100,
    onLine: (line) => lines.push(line),
  });
  assert.ok(lines.includes('PASS  a'));
  assert.ok(lines.some((line) => line.startsWith('... running') && line.includes('1 case(s) done')));
});

test('a timeout is red', () => {
  assert.equal(judgeSuiteRun({ status: null, timedOut: true, output: 'PASS a' }).ok, false);
});

test('sketch, design-canvas and system-view files map to canvas', () => {
  const base = 'apps/ethlete-studio/src/app';
  const { suites } = mapChanged([
    `${base}/design-parts/sketches/a.ts`,
    `${base}/components/design-canvas/b.ts`,
    `${base}/system-view/anything-else.ts`,
  ]);
  assert.ok(suites.includes('canvas'));
  assert.deepEqual(mapChanged([`${base}/system-view/x.ts`]).suites, ['canvas']);
});
