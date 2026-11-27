import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { findingsOf } from './judge.mjs';
import { decodePng } from './png.mjs';
import { logoFindingsOf, trapFindingsOf } from './trap-check.mjs';

const dir = import.meta.dirname;
const excerpt = JSON.parse(readFileSync(join(dir, 'fixtures/run-0236/shots-excerpt.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(dir, 'expect.json'), 'utf8'));
const stub = decodePng(readFileSync(join(dir, 'fixtures/empty-variant-shot.png')));
const shots = excerpt.map((shot) => (shot.frame && !shot.problem ? { ...shot, picture: stub } : shot));

describe('an unfinished sketch in run 2026-11-25-0236', () => {
  it('has no trap findings', () => {
    assert.deepEqual(trapFindingsOf({ expected, shots }), []);
    assert.deepEqual(logoFindingsOf({ expected, shots, katalog: [] }), []);
  });

  it('reports only its status', () => {
    const findings = findingsOf({ shots, refusals: [], result: {} });
    assert.deepEqual(
      findings.map((finding) => finding.seen),
      [
        'Sketch elements/hero steht in Studio auf „in progress“, nicht zur Wahl bereit (2 Zustände gezeichnet).',
        'Sketch elements/shell-app steht in Studio auf „in progress“, nicht zur Wahl bereit (2 Zustände gezeichnet).',
      ],
    );
  });
});
