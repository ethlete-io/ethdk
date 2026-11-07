import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { missingBuildInputs } from './verify-studio-headless.mjs';

test('names each missing build input with the command that builds it', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'studio-headless-inputs-'));
  const entry = join(checkout, 'cli.js');

  assert.deepEqual(missingBuildInputs(checkout, entry), [
    `${entry} is missing - run npx nx build cli`,
    `${join(checkout, 'dist/libs/components/package.json')} is missing - run npx nx build components`,
  ]);
});

test('answers nothing when both builds exist', () => {
  const checkout = mkdtempSync(join(tmpdir(), 'studio-headless-inputs-'));
  const entry = join(checkout, 'cli.js');

  mkdirSync(join(checkout, 'dist/libs/components'), { recursive: true });
  writeFileSync(entry, '');
  writeFileSync(join(checkout, 'dist/libs/components/package.json'), '{}');

  assert.deepEqual(missingBuildInputs(checkout, entry), []);
});
