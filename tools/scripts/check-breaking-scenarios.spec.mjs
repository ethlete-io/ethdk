import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBreakingHeader, scenarioRunsFor } from './check-breaking-scenarios.mjs';

test('only a header with ! before the colon is breaking', () => {
  assert.equal(isBreakingHeader('feat(components)!: Rename state to stepState'), true);
  assert.equal(isBreakingHeader('refactor!: Drop the old API'), true);
  assert.equal(isBreakingHeader('fix(components): Bind stepState\n\nBREAKING!: no'), false);
  assert.equal(isBreakingHeader('docs(repo): Say "wow!: yes"'), false);
});

test('a breaking commit runs the scenarios folder of each staged lib that has one', () => {
  const runs = scenarioRunsFor(
    'feat(components)!: Rename state to stepState',
    ['libs/components/src/lib/a.ts', 'libs/components/src/lib/b.ts', 'libs/cli/src/c.ts', '.changeset/x.md'],
    (lib) => lib === 'components',
  );
  assert.deepEqual(runs, [
    ['vitest', 'run', '--config', 'libs/components/vite.config.mts', 'libs/components/src/scenarios'],
  ]);
});

test('a commit that is not breaking runs nothing', () => {
  assert.deepEqual(
    scenarioRunsFor('fix(components): Bind', ['libs/components/src/a.ts'], () => true),
    [],
  );
});
