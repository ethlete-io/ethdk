import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmapOf, kbdFaceGlyphs, SUBSETS } from './subset-kbd-glyphs.mjs';

// The package ships only these subsets, so a new et-kbd label glyph missing from them falls back to a system font.
test('the committed kbd subset fonts draw every et-kbd label glyph', async () => {
  const drawn = new Set();

  for (const { out } of SUBSETS) for (const char of await cmapOf(out)) drawn.add(char);

  const wanted = await kbdFaceGlyphs();

  assert.equal(wanted.length >= 12, true);
  assert.deepEqual(
    wanted.filter((char) => !drawn.has(char)),
    [],
  );
});
