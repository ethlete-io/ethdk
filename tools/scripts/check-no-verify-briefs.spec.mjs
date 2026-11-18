import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBriefPath, noVerifyFindings } from './check-no-verify-briefs.mjs';

test('flags an instruction to commit with --no-verify', () => {
  assert.deepEqual(noVerifyFindings('a\nrun the commit with --no-verify -m x'), [
    { line: 2, text: 'run the commit with --no-verify -m x' },
  ]);
});

test('allows a line that forbids it', () => {
  assert.deepEqual(noVerifyFindings('Never use --no-verify.'), []);
});

test('ignores text without it', () => {
  assert.deepEqual(noVerifyFindings('commit with -m x'), []);
});

test('counts "no" as a negation', () => {
  assert.deepEqual(noVerifyFindings('No --no-verify on a commit.'), []);
});

test('joins a wrapped line with the negation on the line before', () => {
  assert.deepEqual(noVerifyFindings('Commit through the hooks, never\nwith --no-verify.'), []);
});

test('reports the wrapped line that holds the flag', () => {
  assert.deepEqual(noVerifyFindings('Commit fast and\nskip the hooks with --no-verify.'), [
    { line: 2, text: 'skip the hooks with --no-verify.' },
  ]);
});

test('does not join list items', () => {
  assert.deepEqual(noVerifyFindings('- never push to main\n- commit with --no-verify'), [
    { line: 2, text: '- commit with --no-verify' },
  ]);
});

test('checks only the brief paths it is given', () => {
  assert.equal(isBriefPath('.agents/skills/x/SKILL.md'), true);
  assert.equal(isBriefPath('.agents/skills/x/notes.md'), false);
  assert.equal(isBriefPath('libs/agent-rules/content/rules/a.md'), true);
  assert.equal(isBriefPath('apps/docs/a.md'), false);
});
