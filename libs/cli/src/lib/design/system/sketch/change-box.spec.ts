import { describe, expect, it } from 'vitest';
import { encodePng } from '../part-compare';
import { changeBoxOf } from './change-box';

const pictureOf = (width: number, height: number, dark: { x: number; y: number }[] = []) => {
  const data = Buffer.alloc(width * height * 4, 255);

  for (const { x, y } of dark) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);

  return encodePng({ width, height, data });
};

const strip = (x: number, y: number, width: number) =>
  Array.from({ length: width }, (_, index) => ({ x: x + index, y }));

describe('changeBoxOf', () => {
  it('measures the box, the pixel count and the separate regions of a change', () => {
    const before = pictureOf(200, 100);
    const after = pictureOf(200, 100, [...strip(20, 30, 10), ...strip(150, 80, 5), { x: 152, y: 81 }]);

    expect(changeBoxOf(before, after)).toEqual({
      width: 200,
      height: 100,
      box: { x: 20, y: 30, width: 135, height: 52 },
      pixels: 16,
      regions: 2,
      areas: [
        { x: 20, y: 30, width: 10, height: 1 },
        { x: 150, y: 80, width: 5, height: 2 },
      ],
    });
  });

  it('joins regions closer than 16 pixels into one changed area, as the changed crops of a shot do', () => {
    const before = pictureOf(200, 100);
    const after = pictureOf(200, 100, [...strip(20, 30, 10), ...strip(40, 30, 10)]);

    expect(changeBoxOf(before, after)).toMatchObject({
      regions: 2,
      areas: [{ x: 20, y: 30, width: 30, height: 1 }],
    });
  });

  it('reads a block that only changes its place as one move from the old to the new place', () => {
    const block = (x: number, y: number) => [
      ...Array.from({ length: 12 }, (_, row) => strip(x, y + row, 20)).flat(),
      ...strip(x + 4, y + 14, 6),
    ];
    const before = pictureOf(200, 100, block(130, 10));
    const after = pictureOf(200, 100, block(20, 60));

    expect(changeBoxOf(before, after)).toMatchObject({
      areas: [
        { x: 130, y: 10, width: 20, height: 15 },
        { x: 20, y: 60, width: 20, height: 15 },
      ],
      moves: [{ from: { x: 130, y: 10, width: 20, height: 15 }, to: { x: 20, y: 60, width: 20, height: 15 } }],
    });
  });

  it('reads two places that change to different content as no move', () => {
    const before = pictureOf(200, 100, [...strip(130, 10, 20), ...strip(20, 60, 6)]);
    const after = pictureOf(200, 100, [...strip(130, 12, 20), ...strip(20, 62, 20)]);

    expect(changeBoxOf(before, after)?.moves).toBeUndefined();
  });

  it('answers null for the same picture and for another size', () => {
    const before = pictureOf(40, 20);

    expect(changeBoxOf(before, pictureOf(40, 20))).toBeNull();
    expect(changeBoxOf(before, pictureOf(41, 20, [{ x: 1, y: 1 }]))).toBeNull();
  });
});
