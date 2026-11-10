import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintKeyOf, newFindingLinesOf } from './lint-staged-design.mjs';

const rule = '@typescript-eslint/no-non-null-assertion';
const bang = (file, line) => ({ file, line, column: 5, rule, message: 'Forbidden non-null assertion.' });
const withBaselineIn = (dir) => (path) => path.endsWith(`${dir}/lint-baseline.json`);

test('a sketch variant file counts as the part file it replaces', () => {
  assert.equal(
    lintKeyOf('.ethlete/design/sdk', '.ethlete/design/sdk/sketches/tabs/a/components/tabs/tabs.ts'),
    'components/tabs/tabs.ts',
  );
  assert.equal(lintKeyOf('.ethlete/design/sdk', '.ethlete/design/sdk/sketches/tabs/shared/util.ts'), 'shared/util.ts');
});

test('keeps the old findings the baseline holds and refuses one more', () => {
  const file = '.ethlete/design/sdk/components/tabs/tabs.ts';
  const baseline = () => ({ 'components/tabs/tabs.ts': { [rule]: 1 } });
  const exists = withBaselineIn('.ethlete/design/sdk');

  assert.deepEqual(newFindingLinesOf([bang(file, 16)], baseline, exists), []);
  assert.equal(newFindingLinesOf([bang(file, 16), bang(file, 20)], baseline, exists).length, 2);
  assert.match(
    newFindingLinesOf([bang(file, 16), bang(file, 20)], baseline, exists)[1],
    /^LINT \.ethlete\/design\/sdk\/components\/tabs\/tabs\.ts:20:5 .* \(2 in the file, the baseline allows 1\)$/u,
  );
});

test('refuses any finding in a file no baseline holds', () => {
  const lines = newFindingLinesOf(
    [bang('.ethlete/design/studio/parts/x.ts', 3)],
    () => ({}),
    () => false,
  );

  assert.equal(lines.length, 1);
});
