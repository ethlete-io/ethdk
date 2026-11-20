import { pixelsDiffer } from '../anti-alias';
import { decodePng } from '../part-compare';

export type ChangeBox = {
  width: number;
  height: number;
  box: { x: number; y: number; width: number; height: number };
  pixels: number;
  regions: number;
};

const REGION_CELL = 8;

const regionsOf = (cells: Set<number>, columns: number) => {
  const seen = new Set<number>();
  let regions = 0;

  for (const start of cells) {
    if (seen.has(start)) continue;

    regions++;
    seen.add(start);
    const queue = [start];

    while (queue.length > 0) {
      const cell = queue.pop() ?? 0;
      const column = cell % columns;
      const row = (cell - column) / columns;

      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const next = (row + dy) * columns + column + dx;

          if (column + dx < 0 || column + dx >= columns || !cells.has(next) || seen.has(next)) continue;

          seen.add(next);
          queue.push(next);
        }
    }
  }

  return regions;
};

/**
 * `true` when two pictures have the same size and no channel of any pixel differs by more than 8 of 255, so an
 * anti-alias shift on a rounded edge is no change. A picture that does not decode is the same only byte for byte.
 */
export const looksTheSame = (a: Buffer, b: Buffer) => {
  if (a.equals(b)) return true;

  try {
    const left = decodePng(a);
    const right = decodePng(b);

    if (left.width !== right.width || left.height !== right.height) return false;

    for (let at = 0; at + 4 <= left.data.length; at += 4)
      if (pixelsDiffer(left.data.readUInt32BE(at), right.data.readUInt32BE(at))) return false;

    return true;
  } catch {
    return false;
  }
};

/**
 * Where two PNG pictures of the same size differ, by the same per-channel tolerance `looksTheSame` uses; `null`
 * when they do not differ, do not decode or differ in size.
 */
export const changeBoxOf = (before: Buffer, after: Buffer): ChangeBox | null => {
  try {
    const left = decodePng(before);
    const right = decodePng(after);

    if (left.width !== right.width || left.height !== right.height) return null;

    const { width, height } = left;
    const columns = Math.ceil(width / REGION_CELL);
    const cells = new Set<number>();
    let pixels = 0;
    let top = height;
    let leftmost = width;
    let bottom = -1;
    let rightmost = -1;

    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;

        if (!pixelsDiffer(left.data.readUInt32BE(at), right.data.readUInt32BE(at))) continue;

        pixels++;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        leftmost = Math.min(leftmost, x);
        rightmost = Math.max(rightmost, x);
        cells.add(Math.floor(y / REGION_CELL) * columns + Math.floor(x / REGION_CELL));
      }

    return pixels === 0
      ? null
      : {
          width,
          height,
          box: { x: leftmost, y: top, width: rightmost - leftmost + 1, height: bottom - top + 1 },
          pixels,
          regions: regionsOf(cells, columns),
        };
  } catch {
    return null;
  }
};

export type PixelPair = { same: boolean; change: ChangeBox | null };

/** Whether two PNG pictures look the same (`looksTheSame`) and, when they do not, where they differ (`changeBoxOf`). */
export const pixelPairOf = (a: Buffer, b: Buffer): PixelPair => {
  const same = looksTheSame(a, b);

  return { same, change: same ? null : changeBoxOf(a, b) };
};
