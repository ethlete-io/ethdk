import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { decodePng } from './png.mjs';
import { textOnlyCopiesOf } from './text-only.mjs';

// Shots and text-emptied root shots of the foundations/logo sketch, variant a, of client run 2026-11-24-1109,
// taken on a copy of the run with the judge's probe.
const STATES = ['mark', 'anatomy', 'clear-space', 'minimum-size', 'colour-variants', 'misuse', 'motion'];
const read = (name) => decodePng(readFileSync(join(import.meta.dirname, 'fixtures/logo-1109', name)));
const shotsOf = (states) =>
  states.map((state) => ({ state, picture: read(`${state}.png`), textless: read(`${state}.textless.png`) }));

describe('textOnlyCopiesOf', () => {
  it('groups the five logo states that draw the same mark under another title', () => {
    assert.deepEqual(
      textOnlyCopiesOf(shotsOf(STATES)).map((group) => group.map((shot) => shot.state)),
      [['anatomy', 'clear-space', 'colour-variants', 'misuse', 'motion']],
    );
  });

  it('passes states that each draw something of their own', () => {
    assert.deepEqual(textOnlyCopiesOf(shotsOf(['mark', 'anatomy', 'minimum-size'])), []);
  });

  it('leaves two text-only states to the trap checks', () => {
    assert.deepEqual(textOnlyCopiesOf(shotsOf(['anatomy', 'clear-space'])), []);
  });
});
