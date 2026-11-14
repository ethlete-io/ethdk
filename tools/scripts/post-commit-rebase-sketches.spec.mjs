import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changesDesignParts } from './post-commit-rebase-sketches.mjs';

test('a commit to a design part asks for the rebase', () => {
  assert.equal(changesDesignParts(['M\t.ethlete/design/studio/components/title-bar/title-bar.css', '']), true);
});

test('a commit of sketches only, of no design file, or of a merge does not', () => {
  assert.equal(changesDesignParts(['M\t.ethlete/design/studio/sketches/pages-x.y/sketch.json']), false);
  assert.equal(changesDesignParts(['M\tlibs/cli/src/index.ts']), false);
  assert.equal(
    changesDesignParts([
      'M\t.ethlete/design/studio/components/title-bar/title-bar.css',
      'D\t.ethlete/design/studio/sketches/components-title-bar.notice-arrow/sketch.json',
    ]),
    false,
  );
});
