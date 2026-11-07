import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLaterCommits, markupTokens } from './revert-check.mjs';

const swapDiff = `diff --git a/a.html b/a.html
--- a/a.html
+++ b/a.html
-<div [attr.title]="label()" class="x"></div>
+<div [attr.aria-label]="label()" data-et-tip="1" class="x"></div>
`;

test('markupTokens reads attributes from both sides and skips the diff header and noise', () => {
  assert.deepEqual(markupTokens(swapDiff), ['aria-label', 'data-et-tip', 'title']);
});

const laterLog = [
  '\u0001aaa11111 test(e2e): Locate by aria-label\n--- a/e.e2e.ts\n+++ b/e.e2e.ts\n-page.locator(\'[title="Drag"]\')\n+page.locator(\'[aria-label="Drag"]\')\n',
  '\u0001bbb22222 fix: Unrelated\n--- a/x.ts\n+++ b/x.ts\n-const a = 1\n+const a = 2\n',
  '\u0001ccc33333 docs: Mention 12345678 again\n',
].join('');

test('findLaterCommits flags e2e locators on removed attributes and commits naming the change', () => {
  const later = findLaterCommits({
    sha: '1234567890',
    subject: 'feat: Tooltip swap',
    tokens: ['title', 'aria-label'],
    laterLog,
  });
  assert.deepEqual(
    later.map((commit) => commit.sha),
    ['aaa11111', 'ccc33333'],
  );
  assert.match(later[0].reasons[0], /title, aria-label/);
  assert.equal(later[1].reasons[0], 'names the change');
});
