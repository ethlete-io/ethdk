import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personNameFindings, personNameProblems } from './check-person-names.mjs';

test('flags a known first name as a word and inside a camel-case identifier', () => {
  assert.equal(personNameFindings('ready --by tom').length, 1);
  assert.equal(personNameFindings('class TomPrompt {}').length, 1);
});

test('flags the git user name', () => {
  assert.equal(personNameFindings('by Ada Lovelace today', 'Ada Lovelace').length, 1);
});

test('ignores words that only contain a name', () => {
  assert.deepEqual(personNameFindings('tomorrow the atomic tomato'), []);
});

test('fails only when a file exceeds its baseline', () => {
  const hits = [{ line: 1, text: 'x' }];
  assert.equal(personNameProblems({ 'a.ts': hits }, { 'a.ts': 1 }).length, 0);
  assert.equal(personNameProblems({ 'a.ts': hits }, {}).length, 1);
});

test('reports the right line when a name sits deep in a multi-line text', () => {
  const text = ['one', 'two Words', 'three', 'ask Tom here', 'five'].join('\n');
  assert.deepEqual(personNameFindings(text), [{ line: 4, text: 'ask Tom here' }]);
  assert.deepEqual(personNameFindings('plain\ntext\ntomorrow'), []);
});
