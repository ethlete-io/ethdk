import assert from 'node:assert/strict';
import { test } from 'node:test';
import { studioStatusProblems } from './check-studio-status.mjs';

const today = new Date(2026, 10, 10);
const okRow = '| B101              | Beweis auf dem echten Pfad für B69/B94 (Bef. 174) | 🔨 |';
const doc = (...parts) => ['# Studio – Status', '', 'Stand: 10.11.2026, abends', '', ...parts].join('\n');

test('passes a current file with open rows', () => {
  assert.deepEqual(studioStatusProblems(doc('| ID | Was |', '| --- | --- |', okRow), today), []);
});

test('refuses a done row and names its ID and line', () => {
  const problems = studioStatusProblems(doc(okRow, '| B21 | Fertig | ✅ |'), today);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /row B21/);
  assert.match(problems[0], /line 6/);
  assert.match(problems[0], /Delete the done row/);
});

test('refuses an Erledigt section', () => {
  const problems = studioStatusProblems(doc('## Erledigt (Auszug)', okRow), today);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /line 5/);
  assert.match(problems[0], /Delete the Erledigt section/);
});

test('refuses a Stand older than 3 days, accepts exactly 3', () => {
  const old = studioStatusProblems(doc(okRow).replace('10.11.2026', '06.11.2026'), today);
  assert.equal(old.length, 1);
  assert.match(old[0], /line 3/);
  assert.match(old[0], /Update the Stand date/);
  assert.deepEqual(studioStatusProblems(doc(okRow).replace('10.11.2026', '07.11.2026'), today), []);
});

test('ignores Stand text outside the header line', () => {
  assert.deepEqual(studioStatusProblems(doc('Stand der aktuellen Welle: 01.01.2020', okRow), today), []);
});
