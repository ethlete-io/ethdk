import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { entryOf, pickTitles } from './image-set.mjs';

const titles = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/catalog-titles.json'), 'utf8'));
const entries = pickTitles(titles, 5).map(entryOf);
const entry = (title) => entries.find((e) => e.title === title);

describe('the image set', () => {
  it('picks the 46 B trap titles first, then fills up with a title with logo and one without', () => {
    assert.deepEqual(
      entries.map((e) => e.title),
      ['Vortex', '10 Cloverfield Lane', 'Arcane', 'F1 - Der Film', 'John Williams: Live in Vienna'],
    );
  });

  it('drops the poster of the 46 B title without poster', () => {
    assert.equal(entry('Vortex').plakat, null);
    assert.equal(entry('Vortex').plakatKlein, null);
    assert.ok(entry('Vortex').hintergrund);
  });

  it('carries the 46 B versions, novelty and series counts', () => {
    assert.deepEqual(entry('10 Cloverfield Lane').versions, ['3D', '1080p']);
    assert.equal(entry('F1 - Der Film').isNew, false);
    assert.deepEqual(
      [entry('Arcane').newContent, entry('Arcane').seasonCount, entry('Arcane').episodeCount],
      ['season', 2, 18],
    );
  });
});
