import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { argsOf, compareRunOf, judgeEdit, pictureOf } from './resident-e2e.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures/resident-e2e', name), 'utf8');

const runOf = (name, pid = 7) => {
  const run = { ...compareRunOf(fixture(name)), pid };

  return { ...run, picture: pictureOf(run, (path) => `hash(${path.split('/').at(-1)})`) };
};

describe('resident-e2e', () => {
  it('reads the state line, the pictures dir and a resident start from a real compare', () => {
    const cold = compareRunOf(fixture('compare-cold.log'));
    const edited = compareRunOf(fixture('compare-design-edited.log'));

    assert.equal(cold.residentStart, true);
    assert.match(cold.line, /^out /);
    assert.equal(edited.residentStart, false);
    assert.match(edited.line, /^out SIZE \d+x\d+ vs \d+x\d+$/);
    assert.match(edited.pictures, /et-design-compare-/);
  });

  it('passes an edit that changes the picture and an undo that brings it back', () => {
    const before = runOf('compare-warm.log');
    const verdict = judgeEdit({ side: 'design', before, edited: runOf('compare-design-edited.log'), undone: before });

    assert.deepEqual(verdict, { pass: true, failures: [] });
  });

  it('fails when the edited run serves the old picture', () => {
    const before = runOf('compare-warm.log');
    const verdict = judgeEdit({ side: 'design', before, edited: before, undone: before });

    assert.equal(verdict.pass, false);
    assert.match(verdict.failures[0], /the design edit served the old picture/);
  });

  it('fails when the undo keeps the edited picture or a new resident served a run', () => {
    const before = runOf('compare-warm.log');
    const edited = runOf('compare-design-edited.log');
    const verdict = judgeEdit({ side: 'app', before, edited, undone: { ...edited, pid: 8 } });

    assert.deepEqual(
      verdict.failures.map((failure) => failure.split(':')[0]),
      ['the resident changed', 'undoing the app edit did not bring the first picture back'],
    );
  });

  it('asks for a target', () => {
    assert.match(argsOf([]).error, /usage/);
    assert.equal(argsOf(['--target', '/x']).cli, '/x/dist/libs/cli/src/index.js');
  });
});
