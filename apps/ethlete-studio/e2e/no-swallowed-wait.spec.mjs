import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import { test } from 'node:test';
import { SWALLOWED_WAIT_MESSAGE, SWALLOWED_WAIT_SELECTOR } from './no-swallowed-wait.mjs';

const problemsOf = (code) =>
  new Linter().verify(code, {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-restricted-syntax': ['error', { selector: SWALLOWED_WAIT_SELECTOR, message: SWALLOWED_WAIT_MESSAGE }],
    },
  });

test('the old open points chip wait that swallowed its timeout is rejected', () => {
  const problems = problemsOf(`
    await page
      .locator('ethlete-build-ready-footer et-badge')
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => undefined);
  `);

  assert.equal(problems.length, 1);
  assert.equal(problems[0].message, SWALLOWED_WAIT_MESSAGE);
});

test('a swallowed waitForFunction, waitForSelector and click are rejected', () => {
  assert.equal(problemsOf('await page.waitForFunction(() => true).catch(() => null);').length, 1);
  assert.equal(problemsOf('await page.waitForSelector("a").catch(() => {});').length, 1);
  assert.equal(problemsOf('await page.locator("a").click({ timeout: 1 }).catch(() => undefined);').length, 1);
});

test('a wait that throws and a catch on a non-wait pass', () => {
  assert.equal(problemsOf('await page.locator("a").waitFor({ timeout: 1 });').length, 0);
  assert.equal(problemsOf('await frame.evaluate(() => 1).catch(() => "");').length, 0);
  assert.equal(problemsOf('await route.fallback().catch(() => undefined);').length, 0);
});
