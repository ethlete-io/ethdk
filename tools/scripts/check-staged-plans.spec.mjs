import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetFor, checkStagedPlans } from './check-staged-plans.mjs';

const config = {
  groups: [
    { name: 'finding log', files: ['plans/ethlete-studio/design-to-code.md'], budget: 10 },
    { name: 'status', files: ['plans/ethlete-studio/STATUS.md'], budget: 100 },
  ],
  overrides: { 'plans/ethlete-studio/STATUS.md': 20 },
};

const run = (files, sources, formatted = true) =>
  checkStagedPlans({ files, config, read: (f) => sources[f] ?? '', isFormatted: async () => formatted });

test('budget comes from the override first, then the group', () => {
  assert.equal(budgetFor('plans/ethlete-studio/STATUS.md', config), 20);
  assert.equal(budgetFor('plans/ethlete-studio/design-to-code.md', config), 10);
  assert.equal(budgetFor('other.md', config), undefined);
});

test('an oversize staged plan file is reported with its size', async () => {
  const problems = await run(['plans/ethlete-studio/design-to-code.md'], {
    'plans/ethlete-studio/design-to-code.md': 'x'.repeat(11),
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /11 chars exceeds the budget of 10/);
});

test('an unformatted staged plan file is reported', async () => {
  const problems = await run(['plans/ethlete-studio/STATUS.md'], { 'plans/ethlete-studio/STATUS.md': 'x' }, false);
  assert.match(problems[0], /not formatted/);
});

test('other staged files are ignored', async () => {
  assert.deepEqual(await run(['libs/a.ts'], {}, false), []);
});
