import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkAdr, checkAdrs, findingErrors, orphanWarnings } from './check-studio-adrs.mjs';
import { parseStatusRows } from './studio-status.mjs';

const rows = parseStatusRows(`| ID | Was | Stand |
| -- | -- | -- |
| B1 | open one | ⏳ |
| B2 | done one | ✅ |
`);
const adr = (front) => `---\n${front}\n---\n\n# Title\n`;

test('accepts built and open ADRs', () => {
  assert.deepEqual(checkAdr('a', adr('status: accepted\nbuilt: 409246e68'), rows).errors, []);
  assert.deepEqual(checkAdr('a', adr('status: superseded by 0004\nopen: B1'), rows).errors, []);
});

test('open: none passes with a warning', () => {
  const result = checkAdr('a', adr('status: accepted\nopen: none'), rows);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
});

test('fails a missing row, a done row, and a missing build state', () => {
  assert.equal(checkAdr('a', adr('status: accepted\nopen: B9'), rows).errors.length, 1);
  assert.match(checkAdr('a', adr('status: accepted\nopen: B2'), rows).errors[0], /is done/);
  assert.equal(checkAdr('a', adr('status: accepted'), rows).errors.length, 1);
  assert.equal(checkAdr('a', adr('status: accepted\nbuilt: x\nopen: B1'), rows).errors.length, 1);
});

test('fails a bad status and missing frontmatter', () => {
  assert.equal(checkAdr('a', adr('status: maybe\nbuilt: 409246e68'), rows).errors.length, 1);
  assert.equal(checkAdr('a', '# no front matter', rows).errors.length, 1);
});

test('a missing or empty adr folder passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'adr-'));
  assert.deepEqual(checkAdrs(root), { errors: [], warnings: [] });
  mkdirSync(join(root, 'apps/ethlete-studio/docs/adr'), { recursive: true });
  assert.deepEqual(checkAdrs(root), { errors: [], warnings: [] });
});

test('reads ADR files against STATUS.md from disk', () => {
  const root = mkdtempSync(join(tmpdir(), 'adr-'));
  mkdirSync(join(root, 'apps/ethlete-studio/docs/adr'), { recursive: true });
  mkdirSync(join(root, 'plans/ethlete-studio'), { recursive: true });
  writeFileSync(join(root, 'plans/ethlete-studio/STATUS.md'), '| B1 | x | ✅ |\n');
  writeFileSync(join(root, 'apps/ethlete-studio/docs/adr/0001-a.md'), adr('status: accepted\nopen: B1'));
  assert.equal(checkAdrs(root).errors.length, 1);
});

test('warns only on orphans dated after 2026-11-04', () => {
  const plan =
    '1\\. Tom (2026-11-04): old orphan\n\n2\\. Tom (2026-11-05): new orphan\n\n3\\. Tom (2026-11-06): cited\n';
  const warnings = orphanWarnings(plan, '| B1 | x (Bef. 3) | ⏳ |\n');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /finding 2 /);
});

const fixture = (name) => join(import.meta.dirname, 'fixtures/studio-findings', name);

test('passes findings with unique, increasing numbers that every Bef. resolves to', () => {
  assert.deepEqual(checkAdrs(fixture('ok')).errors, []);
});

test('fails a plan that prettier renumbered', () => {
  const { errors } = checkAdrs(fixture('renumbered'));
  assert.ok(errors.some((e) => /design-to-code\.md:5: "157\. " is a list item/.test(e)));
  assert.ok(errors.some((e) => /B2 cites Bef\. 160, but no finding 160 exists/.test(e)));
});

test('fails a duplicate, a decrease and a dangling Bef.', () => {
  const archives = [{ name: 'findings-2026-11.md', text: '5\\. Tom (2026-11-01): archived.\n' }];
  const plan = '4\\. a\n\n5\\. b\n\n3\\. c\n';
  assert.deepEqual(findingErrors(plan, archives, '| B1 | x (Bef. 4/9) | ⏳ |\n'), [
    'finding 5 exists twice (design-to-code.md)',
    'finding 3 follows finding 5; numbers must increase',
    'B1 cites Bef. 9, but no finding 9 exists',
  ]);
});
