import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import { missingBuildInputs, WEBKIT_BLIND_EXIT, webkitVerdict } from './verify-studio-headless.mjs';

test('names each missing build input with the command that builds it', () => {
  const checkout = tempDir('studio-headless-inputs-');
  const entry = join(checkout, 'cli.js');

  assert.deepEqual(missingBuildInputs(checkout, entry), [
    `${entry} is missing - run npx nx build cli`,
    `${join(checkout, 'dist/libs/components/package.json')} is missing - run npx nx build components`,
  ]);
});

test('answers nothing when both builds exist', () => {
  const checkout = tempDir('studio-headless-inputs-');
  const entry = join(checkout, 'cli.js');

  mkdirSync(join(checkout, 'dist/libs/components'), { recursive: true });
  writeFileSync(entry, '');
  writeFileSync(join(checkout, 'dist/libs/components/package.json'), '{}');

  assert.deepEqual(missingBuildInputs(checkout, entry), []);
});

test('calls a WebKit run blind, not failed, when only the wheel control got no event', () => {
  assert.deepEqual(webkitVerdict({ 'frame-wheel': WEBKIT_BLIND_EXIT, soak: 0 }), {
    exit: WEBKIT_BLIND_EXIT,
    lines: ['BLIND: frame-wheel - the wheel control got no event, so the run proves nothing'],
  });
});

test('still fails a WebKit run when another check failed next to a blind one', () => {
  const verdict = webkitVerdict({ 'frame-wheel': WEBKIT_BLIND_EXIT, paint: 1 });

  assert.equal(verdict.exit, 1);
  assert.deepEqual(verdict.lines, [
    'FAIL: paint',
    'BLIND: frame-wheel - the wheel control got no event, so the run proves nothing',
  ]);
});

test('passes a WebKit run only when every check passed', () => {
  assert.deepEqual(webkitVerdict({ 'frame-wheel': 0, edges: 0 }), { exit: 0, lines: [] });
});
