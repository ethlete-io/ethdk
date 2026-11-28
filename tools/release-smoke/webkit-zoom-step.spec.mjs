import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runWebkitZoomStep, webkitZoomPlan, WEBKIT_ZOOM_CASE } from './webkit-zoom-step.mjs';

test('the plan runs the WebKit zoom case on the Mac with the perf flag', () => {
  const { command, args } = webkitZoomPlan();
  assert.equal(command, 'node');
  assert.ok(args.join(' ').includes('heavy.mjs run --on mac -- yarn studio:e2e --perf --engine webkit --case'));
  assert.equal(args.at(-1), WEBKIT_ZOOM_CASE);
});

test('a passing case passes the step', async () => {
  assert.equal(await runWebkitZoomStep(async () => 0), null);
});

test('a failing or unreachable case fails the step naming the case and B910', async () => {
  const message = await runWebkitZoomStep(async () => 1);
  assert.match(message, /B910/);
  assert.ok(message.includes(WEBKIT_ZOOM_CASE));
});

test('smoke.mjs runs the step and fails the smoke on its message', () => {
  const smoke = readFileSync(new URL('./smoke.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /runWebkitZoomStep\(run\)/);
  assert.match(smoke, /webkitFailure/);
});
