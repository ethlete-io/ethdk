import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join } from 'node:path';
import { findingKey, headOf, keysOfMarkdown, previousRunOf } from './findings-head.mjs';
import { readFileSync } from 'node:fs';

const runs = join(import.meta.dirname, 'fixtures/runs');
const run1751 = join(runs, '2026-11-24-1751');
const run0236 = join(runs, '2026-11-25-0236');

describe('findingKey', () => {
  it('ignores the variant list', () => {
    assert.equal(
      findingKey('App Shell (elements/shell-app, Variante b, c): Falle „Desktop“ hat keinen Zustand.'),
      findingKey('App Shell (elements/shell-app, Variante a, b, c): Falle „Desktop“ hat keinen Zustand.'),
    );
  });
});

describe('headOf on real runs', () => {
  it('finds the previous run by stamp', () => {
    assert.equal(previousRunOf(run0236), run1751);
    assert.equal(previousRunOf(run1751), null);
  });

  it('fails a run with findings and diffs against the previous run', () => {
    const keys = keysOfMarkdown(readFileSync(join(run0236, 'findings.md'), 'utf8'));
    const head = headOf({ findings: keys.map((seen) => ({ seen })), previous: run1751 });
    assert.match(head, /^Urteil: DURCHGEFALLEN \(23 Befunde\)\./);
    assert.match(head, /Gegenüber 2026-11-24-1751: 23 neu, 3 weg, 0 weiter offen\./);
  });

  it('passes a run without findings and lists the previous ones as gone', () => {
    const head = headOf({ findings: [], previous: run1751 });
    assert.match(head, /^Urteil: BESTANDEN \(0 Befunde\)\./);
    assert.match(head, /0 neu, 3 weg, 0 weiter offen/);
  });

  it('keeps a finding open that both runs report', () => {
    const [first] = keysOfMarkdown(readFileSync(join(run1751, 'findings.md'), 'utf8'));
    const head = headOf({ findings: [{ seen: first }], previous: run1751 });
    assert.match(head, /0 neu, 2 weg, 1 weiter offen/);
  });
});
