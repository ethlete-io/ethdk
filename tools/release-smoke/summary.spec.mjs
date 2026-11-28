import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { summaryLines } from './summary.mjs';
import { webkitGateResult } from './webkit-zoom-step.mjs';

test('a failed webkit gate result prints in the summary instead of crashing it', () => {
  const lines = summaryLines([
    { name: 'app', failures: [], notes: [], warnings: ['bundle budget'] },
    webkitGateResult('sketch fixture check failed: pages/system/a'),
  ]);
  assert.ok(lines.includes('⚠ app'));
  assert.ok(lines.includes('✖ webkit zoom gate'));
  assert.equal(lines.at(-1), 'FAIL: 1 of 2 app(s)');
});

test('a result without warnings still prints', () => {
  assert.doesNotThrow(() => summaryLines([{ name: 'x', failures: ['f'], notes: [] }]));
});

test('smoke.mjs builds the gate result with webkitGateResult', () => {
  const smoke = readFileSync(new URL('./smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /webkitGateResult\(webkitFailure\)/);
  assert.doesNotMatch(smoke, /name: 'webkit zoom gate'/);
});
