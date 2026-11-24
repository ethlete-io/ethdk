import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { decodePng, differenceOf, inkOf } from './png.mjs';

const fixture = (name) => decodePng(readFileSync(join(import.meta.dirname, 'fixtures', name)));

describe('decodePng', () => {
  it('decodes a real design shot to its size and first pixel', () => {
    const shot = fixture('logo-accent-shot.png');

    assert.deepEqual([shot.width, shot.height], [570, 228]);
    assert.deepEqual([...shot.rgba.subarray(0, 4)], [0x0b, 0x0f, 0x16, 0xff]);
  });
});

describe('inkOf', () => {
  it('reads a drawn shot as having ink and the empty variant shot as none', () => {
    assert.ok(inkOf(fixture('logo-accent-shot.png')) > 0.05);
    assert.equal(inkOf(fixture('empty-variant-shot.png')), 0);
  });

  it('reads the opaque black focus ring on a transparent background as ink', () => {
    const shot = fixture('title-card-film-focus-visible-shot.png');
    const [left, top, width, height] = [0, 60, 24, 240];
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      rgba.set(
        shot.rgba.subarray(((top + y) * shot.width + left) * 4, ((top + y) * shot.width + left + width) * 4),
        y * width * 4,
      );

    assert.ok(inkOf({ width, height, rgba }) > 0.05);
  });
});

describe('differenceOf', () => {
  it('is 0 for the same picture and 1 for pictures of different size', () => {
    const shot = fixture('logo-accent-shot.png');

    assert.equal(differenceOf(shot, shot), 0);
    assert.equal(differenceOf(shot, fixture('empty-variant-shot.png')), 1);
  });

  it('sees a focus ring drawn as opaque black on a transparent background', () => {
    const rest = fixture('title-card-film-shot.png');
    const focused = fixture('title-card-film-focus-visible-shot.png');

    assert.ok(differenceOf(rest, focused) > 0.01);
  });
});
