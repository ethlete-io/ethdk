import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zoomP50BudgetOf } from './zoom-budget.mjs';

test('the CI WebKit p50 of the red run 46051176731 is reported, not enforced', () => {
  assert.ok(85 <= zoomP50BudgetOf('webkit', { CI: 'true' }));
});

test('Chromium on CI and WebKit off CI keep the 20 ms p50 budget', () => {
  assert.equal(zoomP50BudgetOf('chromium', { CI: 'true' }), 20);
  assert.equal(zoomP50BudgetOf('webkit', {}), 20);
});
