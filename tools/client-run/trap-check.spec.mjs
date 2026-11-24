import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { trapFindingsOf } from './trap-check.mjs';

const views = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/run-1029-views.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(import.meta.dirname, 'expect.json'), 'utf8'));
const seen = trapFindingsOf({ expected, shots: views }).map((finding) => finding.seen);

describe('trapFindingsOf on run 2026-11-24-1029', () => {
  it('reports the title card traps no variant shows', () => {
    for (const trap of ['ohne Plakat', '4K', '3D', 'Neu', 'Neue Staffel', 'Serie', 'langer Titel', 'mobil'])
      assert.ok(
        seen.includes(`Titelkarte (components/title-card, Variante a, b, c): Falle „${trap}“ hat keinen Zustand.`),
        trap,
      );
  });

  it('accepts the hover and focus states every title card variant has', () => {
    assert.ok(!seen.some((line) => /Titelkarte.*„(Hover|Fokus)“/.test(line)));
  });

  it('reports the desktop hero and shell the run drew only at 390 px', () => {
    assert.ok(seen.includes('Hero (elements/hero): Falle „Desktop“ hat keinen Zustand.'));
    assert.ok(seen.includes('App Shell (elements/shell): Falle „Desktop“ hat keinen Zustand.'));
    assert.ok(!seen.includes('Hero (elements/hero): Falle „mobil“ hat keinen Zustand.'));
  });

  it('reports the pressed button the run did not draw', () => {
    assert.ok(seen.includes('Button (components/button): Falle „gedrückt“ hat keinen Zustand.'));
    assert.ok(!seen.some((line) => /Button.*„(Hover|Fokus|deaktiviert)“/.test(line)));
  });

  it('reports nothing for a part without traps or a sketch the tree lacks', () => {
    assert.ok(!seen.some((line) => /^(Farben|Marken-Logo)/.test(line)));
    assert.deepEqual(trapFindingsOf({ expected, shots: [] }), []);
  });
});
