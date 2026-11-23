import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { tempDir } from './temp-dir.mjs';
import { checkAdr, checkAdrs, warningLines } from './check-studio-adrs.mjs';

const adr = (front) => `---\n${front}\n---\n\n# Title\n`;

test('accepts an accepted or superseded status', () => {
  assert.deepEqual(checkAdr('a', adr('status: accepted')).errors, []);
  assert.deepEqual(checkAdr('a', adr('status: superseded by 0004')).errors, []);
});

test('fails a bad status and missing frontmatter', () => {
  assert.equal(checkAdr('a', adr('status: maybe')).errors.length, 1);
  assert.equal(checkAdr('a', '# no front matter').errors.length, 1);
});

test('a missing or empty adr folder passes', () => {
  const root = tempDir('adr-');
  assert.deepEqual(checkAdrs(root), { errors: [], warnings: [] });
  mkdirSync(join(root, 'apps/ethlete-studio/docs/adr'), { recursive: true });
  assert.deepEqual(checkAdrs(root), { errors: [], warnings: [] });
});

const putAdr = (root, rel, text) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};

test('an ADR in the repo-level docs/adr is checked', () => {
  const root = tempDir('adr-');
  putAdr(root, 'docs/adr/0300-a.md', adr('status: bogus'));
  assert.match(checkAdrs(root).errors[0], /^docs\/adr\/0300-a\.md: status/);
});

test('the same number in both folders is an error naming both paths', () => {
  const root = tempDir('adr-');
  const ok = adr('status: accepted');
  putAdr(root, 'docs/adr/0300-a.md', ok);
  putAdr(root, 'apps/ethlete-studio/docs/adr/0300-b.md', ok);
  const { errors } = checkAdrs(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /0300.*apps\/ethlete-studio\/docs\/adr\/0300-b\.md.*docs\/adr\/0300-a\.md/);
});

test('the pre-commit hook runs the check when an ADR is staged', () => {
  const hook = readFileSync(new URL('../../.husky/pre-commit', import.meta.url), 'utf8');
  assert.match(hook, /apps\/ethlete-studio\/docs\/adr\/\*\.md/);
  assert.match(hook, /node \.\/tools\/scripts\/check-studio-adrs\.mjs --summary/);
  assert.match(hook, /^set -e$/m);
});

test('the summary prints one line for many warnings and every line without it', () => {
  const warnings = ['a', 'b', 'c'];
  assert.deepEqual(warningLines(warnings, { summary: true }), [
    'warning: 3 studio ADR warning(s); run `yarn lint:studio-adrs` for the list',
  ]);
  assert.deepEqual(warningLines(warnings), ['warning: a', 'warning: b', 'warning: c']);
  assert.deepEqual(warningLines([], { summary: true }), []);
});

test('parts must be a list of existing design parts', () => {
  const known = (part) => part === 'components/title-bar';
  const check = (front) => checkAdr('a', adr(`status: accepted\n${front}`), known).errors;

  assert.deepEqual(check('parts: [components/title-bar]'), []);
  assert.match(check('parts: components/title-bar')[0], /parts must be a list/);
  assert.match(check('parts: []')[0], /parts must be a list/);
  assert.match(check('parts: [components/missing]')[0], /components\/missing, which is not a design part/);
});
