import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changesDesignParts, rebasedFilesOf } from './post-commit-rebase-sketches.mjs';

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

test('the rebase commit takes only the files the rebase made dirty', () => {
  const home = '.ethlete/design/studio/sketches/pages-home';

  assert.deepEqual(
    rebasedFilesOf({
      dirtyBefore: [`${home}/a/home.css`, '.ethlete/design/studio/pages/home/home.css'],
      dirtyAfter: [`${home}/sketch.json`, `${home}/a/home.css`],
    }),
    { files: [`${home}/sketch.json`], kept: [`${home}/a/home.css`] },
  );
});
