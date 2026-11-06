import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baselinedLines, failingProductsOf, productsToCheck } from './design-rules-gate.mjs';

const config = {
  products: {
    sdk: { harness: { app: 'apps/docs-examples' } },
    studio: { base: '.ethlete/design/sdk', harness: { app: 'apps/ethlete-studio' } },
    lab: {},
  },
};

test('checks the product whose harness app changes', () => {
  assert.deepEqual(productsToCheck(config, ['apps/ethlete-studio/src/app/x.component.ts']), ['studio']);
});

test('checks a product and the products built on it when its design changes', () => {
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/sdk/components/button/button.ts']), ['sdk', 'studio']);
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/lab/pages/home/home.ts']), ['lab']);
});

test('checks every product when the design rules or the config change', () => {
  assert.deepEqual(productsToCheck(config, ['libs/cli/src/lib/design/serve.ts']), ['sdk', 'studio', 'lab']);
  assert.deepEqual(productsToCheck(config, ['.ethlete/design/config.json']), ['sdk', 'studio', 'lab']);
});

test('checks nothing for a range outside every product', () => {
  assert.deepEqual(productsToCheck(config, ['apps/ethlete-studio-e2e/x.ts', 'libs/components/src/a.ts']), []);
  assert.deepEqual(productsToCheck(undefined, ['apps/ethlete-studio/x.ts']), []);
});

test('keeps the baseline lines of a passing check from either stream', () => {
  const result = {
    stdout: 'checked 12 parts\nbaselined (ADR 0205): pages/system - finding 495\n',
    stderr: 'baselined (ADR 0205): pages/sketches - finding 495\n',
  };

  assert.deepEqual(baselinedLines(result), [
    'baselined (ADR 0205): pages/system - finding 495',
    'baselined (ADR 0205): pages/sketches - finding 495',
  ]);
  assert.deepEqual(baselinedLines({ stdout: 'ok\n' }), []);
});

test('names only the products with problems, not a clean product checked next to them', () => {
  const products = ['studio-lab', 'sdk', 'studio'];

  assert.deepEqual(failingProductsOf({ stdout: 'baselined (ADR 0205): x\n27 problem(s) in studio.\n' }, products), [
    'studio',
  ]);
  assert.deepEqual(failingProductsOf({ stdout: '3 problem(s) in sdk, studio.\n' }, products), ['sdk', 'studio']);
  assert.deepEqual(failingProductsOf({ stdout: '' }, products), products);
});
