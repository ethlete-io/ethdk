import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plansProblems } from './check-plans.mjs';

const TODAY = '2026-11-18';

const run = (tree, { dates = {}, repoFiles = [] } = {}) =>
  plansProblems({
    files: new Map(Object.entries(tree)),
    repoFiles,
    lastChange: (path) => dates[path] ?? TODAY,
    today: TODAY,
  });

const status = (body = '') => `# Status\n${body}\n`;

test('a clean tree has no problems', () => {
  assert.deepEqual(run({ 'plans/a/STATUS.md': status('- [x](./x.md)'), 'plans/a/x.md': '# x\n' }), []);
});

test('unlinked: a file no STATUS links is reported, a linked file or directory is not', () => {
  const problems = run({ 'plans/a/STATUS.md': status('[d](./dir/)'), 'plans/a/dir/y.md': 'y', 'plans/a/z.md': 'z' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^plans\/a\/z\.md: no STATUS\.md links this file\. Fix: link it from/);
});

test('unlinked: a loose file in plans/ is always reported', () => {
  const problems = run({ 'plans/a/STATUS.md': status('[l](../loose.md)'), 'plans/loose.md': 'x' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^plans\/loose\.md: /);
});

test('size: a plan over 30000 characters and a STATUS over 5000 are reported', () => {
  const problems = run({
    'plans/a/STATUS.md': status(`[x](./x.md)\n${'a'.repeat(5000)}`),
    'plans/a/x.md': 'x'.repeat(30001),
    'plans/b/STATUS.md': status('[x](./x.md)'),
    'plans/b/x.md': 'x'.repeat(30000),
  });
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /^plans\/a\/STATUS\.md: .*limit 5000/.test(p)));
  assert.ok(problems.some((p) => /^plans\/a\/x\.md: .*limit 30000/.test(p)));
});

test('stale: an old file is reported, a recent one is not', () => {
  const tree = { 'plans/a/STATUS.md': status('[x](./x.md)'), 'plans/a/x.md': 'x' };
  assert.match(
    run(tree, { dates: { 'plans/a/x.md': '2026-11-03' } })[0],
    /^plans\/a\/x\.md: .*not parked\. Fix: mark it parked/,
  );
  assert.deepEqual(run(tree, { dates: { 'plans/a/x.md': '2026-11-04' } }), []);
});

test('stale: a parked line in the file parks it', () => {
  const tree = { 'plans/a/STATUS.md': status('[x](./x.md)'), 'plans/a/x.md': 'x\nparked since 2026-10-01\n' };
  assert.deepEqual(run(tree, { dates: { 'plans/a/x.md': '2026-10-01' } }), []);
});

test('stale: a parked line in the linking STATUS parks every linked file', () => {
  const tree = { 'plans/a/STATUS.md': status('parked since 2026-10-01\n[x](./x.md)'), 'plans/a/x.md': 'x' };
  assert.deepEqual(run(tree, { dates: { 'plans/a/x.md': '2026-10-01', 'plans/a/STATUS.md': '2026-10-01' } }), []);
});

const findings = '# F\n1. one\n2. two\n3. ~~three~~\n## 4. four\n';

test('findings: entries without a queue mention are reported, struck ones are not', () => {
  const problems = run({
    'plans/a/STATUS.md': status('[f](./findings-1.md)'),
    'plans/a/findings-1.md': findings,
  });
  assert.deepEqual(
    problems.map((p) => /finding (\d+)/.exec(p)[1]),
    ['1', '2', '4'],
  );
  assert.match(problems[0], /Fix: add a queue row for it, or strike it\.$/);
});

test('findings: a mention in the product STATUS or a row naming the file covers an entry', () => {
  const problems = run({
    'plans/a/STATUS.md': status('[f](./findings-1.md)\nB1: Befunde #1, dann #4'),
    'plans/a/findings-1.md': findings,
    'plans/studio/STATUS.md': status('[r](./rows.md)'),
    'plans/studio/rows.md': '| B2 | findings-1.md: #2 |\n',
  });
  assert.deepEqual(problems, []);
});

test('findings: a range covers the entries inside it, and #1 does not cover #18', () => {
  const text = '1. a\n2. b\n3. c\n18. d\n';
  const problems = run({
    'plans/a/STATUS.md': status('[f](./findings-1.md)\nB1: Befunde #1-#3'),
    'plans/a/findings-1.md': text,
  });
  assert.deepEqual(
    problems.map((p) => /finding (\d+)/.exec(p)[1]),
    ['18'],
  );
});

test('missing reference: a dead relative link is reported, live, external and anchor links are not', () => {
  const problems = run(
    {
      'plans/a/STATUS.md': status('[x](./x.md)'),
      'plans/a/x.md':
        '[ok](./STATUS.md#top) [web](https://e.com) [self](#a) [repo](../../libs/a.ts) [dir](../../libs) [gone](./gone.md) [r](../../libs/gone.ts) `[c](./code.md)`',
    },
    { repoFiles: ['libs/a.ts'] },
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /links \.\/gone\.md.*Fix: point it at/);
  assert.match(problems[1], /links \.\.\/\.\.\/libs\/gone\.ts/);
});

test('missing reference: archive files are not checked', () => {
  assert.deepEqual(run({ 'plans/a/STATUS.md': status(), 'plans/a/archive/old.md': '[x](./gone.md)' }), []);
});

test('due date: a passed date is reported, a future, struck or other-file date is not', () => {
  const problems = run({
    'plans/a/STATUS.md': status('B1 Fällig: 2026-11-17\nB2 fällig 2026-11-18\nB3 fällig: 2026-11-01 ~~\n[x](./x.md)'),
    'plans/a/x.md': 'fällig: 2020-01-01',
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^plans\/a\/STATUS\.md: due date 2026-11-17 has passed\. Fix: do it/);
});
