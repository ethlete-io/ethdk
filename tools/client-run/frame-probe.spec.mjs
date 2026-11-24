import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { frameFindingsOf } from './frame-probe.mjs';

// Probes of the 2026-11-24-0056 title card on a copy of the run: variant b with the logo path an agent would
// write for `~/bilder-von-tom`, variant c at 120 px, variant a at 40 px and as the agent left it. The `title-card-film`
// probes are the human's tomflix title card (state film, 112 and 168 px) in a cell that follows the reported height.
// `card-fixed-height-168` is the card of apps/ethlete-studio/e2e/fixtures/frame-scrollbar in a 168x120 cell.
const { probes } = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/frame-probes.json'), 'utf8'));
const seenOf = (name) => frameFindingsOf(probes[name]).map((finding) => finding.seen);

describe('frameFindingsOf', () => {
  it('reports the logo that does not load as a missing image, once', () => {
    assert.deepEqual(seenOf('b-logo'), ['Bild img.tf-title-card-logo fehlt (kaputtes Bild-Symbol).']);
  });

  it('reports the clamped fallback title of a too narrow card as cut-off text, not the clipped scrim', () => {
    assert.deepEqual(seenOf('c-fallback-narrow'), ['Text „John Williams: Live in Vienna“ ist abgeschnitten.']);
  });

  it('reports nothing for the card the agent drew', () => {
    assert.deepEqual(seenOf('a-logo'), []);
  });

  it('reports the meta line of a card drawn at 40 px as running out of its box and out of the frame', () => {
    assert.deepEqual(seenOf('a-logo-40'), [
      'Text „2024 · Film“ läuft aus seinem Kasten.',
      'Inhalt ist größer als der Rahmen (40x179) und wird abgeschnitten.',
    ]);
  });

  it('reports the scrollbar a cell keeps when the frame measured its height with the scrollbar', () => {
    assert.deepEqual(seenOf('title-card-film-168'), ['Der Rahmen zeigt eine Scrollleiste.']);
    assert.ok(seenOf('title-card-film-112').includes('Der Rahmen zeigt eine Scrollleiste.'));
  });

  it('reports content taller than a fixed-height frame that hides its scrollbar', () => {
    assert.deepEqual(seenOf('card-fixed-height-168'), [
      'Inhalt ist höher als der Rahmen (168x120) und wird abgeschnitten.',
    ]);
  });
});
