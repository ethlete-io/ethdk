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
    });
  });

  it('answers null for the same picture and for another size', () => {
    const before = pictureOf(40, 20);

    expect(changeBoxOf(before, pictureOf(40, 20))).toBeNull();
    expect(changeBoxOf(before, pictureOf(41, 20, [{ x: 1, y: 1 }]))).toBeNull();
  });
});
