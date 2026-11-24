import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { treeFindingsOf } from './tree-check.mjs';

const sketches = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/sketches-listing.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(import.meta.dirname, 'expect.json'), 'utf8'));
const seenOf = (order) => treeFindingsOf({ expected: { sketches: [order] }, sketches }).map((f) => f.seen);

describe('treeFindingsOf', () => {
  it('finds the title card of the 2026-11-24 run and reports each other ordered part as missing', () => {
    assert.deepEqual(
      treeFindingsOf({ expected, sketches }).map((finding) => finding.seen),
      ['Farben', 'Marken-Logo', 'Button', 'App Shell', 'Hero'].map(
        (label) => `Im Baum fehlt der bestellte Sketch „${label}“.`,
      ),
    );
  });

  it('reports an ordered sketch the tree does not show', () => {
    assert.deepEqual(seenOf({ label: 'Suchleiste', match: 'search|such' }), [
      'Im Baum fehlt der bestellte Sketch „Suchleiste“.',
    ]);
  });

  it('reports a variant count outside the ordered range', () => {
    assert.deepEqual(seenOf({ label: 'Titelkarte', match: 'title', variants: [2, 2] }), [
      'Sketch components/title-card zeigt 3 Varianten, bestellt waren 2.',
    ]);
  });
});
