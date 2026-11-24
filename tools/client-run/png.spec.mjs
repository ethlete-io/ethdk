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
});

describe('differenceOf', () => {
  it('is 0 for the same picture and 1 for pictures of different size', () => {
    const shot = fixture('logo-accent-shot.png');

    assert.equal(differenceOf(shot, shot), 0);
    assert.equal(differenceOf(shot, fixture('empty-variant-shot.png')), 1);
  });
});
