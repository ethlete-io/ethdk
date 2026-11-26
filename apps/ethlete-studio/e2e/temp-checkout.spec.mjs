import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { tempCheckout } from './temp-checkout.mjs';

test('a write into the temp checkout leaves the source tree untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'temp-checkout-spec-'));
  const dirs = [root];

  try {
    mkdirSync(join(root, '.ethlete/design/studio/sketches'), { recursive: true });
    mkdirSync(join(root, 'libs'));
    writeFileSync(join(root, '.ethlete/design/studio/a.json'), '{}');

    const dir = tempCheckout(root, 'temp-checkout-spec-copy-');

    dirs.push(dir);
    mkdirSync(join(dir, '.ethlete/design/studio/sketches/components-zoom-chip'));
    writeFileSync(join(dir, '.ethlete/design/studio/a.json'), '{"changed":true}');

    assert.equal(existsSync(join(root, '.ethlete/design/studio/sketches/components-zoom-chip')), false);
    assert.equal(readFileSync(join(root, '.ethlete/design/studio/a.json'), 'utf8'), '{}');
    assert.equal(lstatSync(join(dir, 'libs')).isSymbolicLink(), true);
    assert.equal(lstatSync(join(dir, '.ethlete')).isSymbolicLink(), false);
  } finally {
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  }
});
