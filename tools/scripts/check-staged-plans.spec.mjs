import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetFor, checkStagedPlans } from './check-staged-plans.mjs';

const config = {
  groups: [
    { name: 'finding log', files: ['plans/ethlete-studio/design-to-code.md'], budget: 10 },
    { name: 'status', files: ['plans/ethlete-studio/STATUS.md'], budget: 100, cellCap: 10 },
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
  assert.match(problems[0], /11 chars without table padding exceeds the budget of 10/);
});

test('an unformatted staged plan file is reported', async () => {
  const problems = await run(['plans/ethlete-studio/STATUS.md'], { 'plans/ethlete-studio/STATUS.md': 'x' }, false);
  assert.match(problems[0], /not formatted/);
});

test('other staged files are ignored', async () => {
  assert.deepEqual(await run(['libs/a.ts'], {}, false), []);
});

test('any unformatted staged Markdown file is reported, without a budget', async () => {
  const problems = await run(
    ['plans/ethlete-studio/handoff-doc-agent.md'],
    { 'plans/ethlete-studio/handoff-doc-agent.md': 'x'.repeat(500) },
    false,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /handoff-doc-agent.md: not formatted/);
});

test('the budget counts a table without its padding', async () => {
  const problems = await run(['plans/ethlete-studio/design-to-code.md'], {
    'plans/ethlete-studio/design-to-code.md': '| a        |',
  });
  assert.deepEqual(problems, []);
});

test('a cell over the cap names its row', async () => {
  const problems = await run(['plans/ethlete-studio/STATUS.md'], {
    'plans/ethlete-studio/STATUS.md': '| B1 | short |\n| B2 | far too long a cell |',
  });
  assert.deepEqual(
    problems.filter((problem) => problem.includes('row ')),
    ['plans/ethlete-studio/STATUS.md: row B2 has a 19-char cell, over the cap of 10. Shorten it.'],
  );
});
