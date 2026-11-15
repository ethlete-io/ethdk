import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changesDesignParts,
  rebaseCliOf,
  rebasedFilesOf,
  rebaseUncommittedAfter,
} from './post-commit-rebase-sketches.mjs';

test('a commit to a design part asks for the rebase', () => {
  assert.equal(changesDesignParts(['M\t.ethlete/design/studio/components/title-bar/title-bar.css', '']), true);
});

test('a commit to a part whose path holds a sketches folder asks for the rebase', () => {
  assert.equal(changesDesignParts(['M\t.ethlete/design/studio/pages/sketches/sketches.ts']), true);
  assert.equal(changesDesignParts(['M\t.ethlete/design/studio/pages/sketches/shared/change-crop.ts']), true);
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

test('a sketch with an uncommitted rebase file is recorded, one committed whole is dropped', () => {
  const home = '.ethlete/design/studio/sketches/pages-home';
  const bar = '.ethlete/design/studio/sketches/components-title-bar';

  assert.deepEqual(
    rebaseUncommittedAfter({
      recorded: { 'components-title-bar': { commit: 'old' }, 'pages-other': { commit: 'old' } },
      sketchDirs: [home, bar],
      uncommitted: [`${home}/sketch.json`],
      commit: 'abc1234',
    }),
    { 'pages-home': { commit: 'abc1234' }, 'pages-other': { commit: 'old' } },
  );
});

test('the rebase runs the committed copy of the head CLI when one exists', () => {
  const buildWorkingTree = () => assert.fail('no build with a copy at hand');

  assert.deepEqual(rebaseCliOf({ copy: { entry: 'copy/index.js' }, cliDirty: true, buildWorkingTree }), {
    entry: 'copy/index.js',
    dir: null,
  });
});

test('a commit that changed libs/cli itself builds the clean working tree CLI for the rebase', () => {
  assert.deepEqual(
    rebaseCliOf({ copy: null, cliDirty: false, buildWorkingTree: () => ({ entry: 'w/src/index.js', dir: 'w' }) }),
    { entry: 'w/src/index.js', dir: 'w' },
  );
});

test('no copy and a dirty libs/cli runs no rebase', () => {
  assert.equal(
    rebaseCliOf({ copy: null, cliDirty: true, buildWorkingTree: () => assert.fail('no build of foreign edits') }),
    null,
  );
});
