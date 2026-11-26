import { pixelsDiffer } from '../anti-alias';
import { decodePng } from '../part-compare';
import { ChangedBox, changedAreasOf } from '../../changed-areas';

export type ChangeBox = {
  width: number;
  height: number;
  box: { x: number; y: number; width: number; height: number };
  pixels: number;
  regions: number;
  areas: ChangedBox[];
  /** Each changed area whose content shows up unchanged at another changed area: the same content in a new place. */
  moves?: ChangeMove[];
};

export type ChangeMove = { from: ChangedBox; to: ChangedBox };

type Picture = { width: number; height: number; data: Buffer };

const REGION_CELL = 8;

type Bounds = [left: number, top: number, right: number, bottom: number];

const regionBoxesOf = (cells: Map<number, Bounds>, columns: number) => {
  const seen = new Set<number>();
  const boxes: ChangedBox[] = [];

  for (const [start, first] of cells) {
    if (seen.has(start)) continue;

    seen.add(start);
    const queue = [start];
    let [left, top, right, bottom] = first;

    while (queue.length > 0) {
      const cell = queue.pop() ?? 0;
      const column = cell % columns;
      const row = (cell - column) / columns;
      const [cellLeft, cellTop, cellRight, cellBottom] = cells.get(cell) ?? first;

      left = Math.min(left, cellLeft);
      top = Math.min(top, cellTop);
      right = Math.max(right, cellRight);
      bottom = Math.max(bottom, cellBottom);

      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const next = (row + dy) * columns + column + dx;

          if (column + dx < 0 || column + dx >= columns || !cells.has(next) || seen.has(next)) continue;

          seen.add(next);
          queue.push(next);
        }
    }

    boxes.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
  }

  return boxes;
};

const MOVE_MATCH = 0.9;
const MOVE_SIZE_SLACK = 0.25;

const wordOf = (picture: Picture, { x, y }: { x: number; y: number }) =>
  picture.data.readUInt32BE((y * picture.width + x) * 4);

const busynessOf = (picture: Picture, box: ChangedBox) => {
  let edges = 0;

  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x; x < box.x + box.width; x++) {
      const word = wordOf(picture, { x, y });

      if (x > 0 && pixelsDiffer(word, wordOf(picture, { x: x - 1, y }))) edges++;
      if (y > 0 && pixelsDiffer(word, wordOf(picture, { x, y: y - 1 }))) edges++;
    }

  return edges;
};

const carriesOver = (
  { from, to }: { from: Picture; to: Picture },
  { box, offset }: { box: ChangedBox; offset: { x: number; y: number } },
) => {
  let changed = 0;
  let matched = 0;

  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x; x < box.x + box.width; x++) {
      const word = wordOf(from, { x, y });

      if (!pixelsDiffer(word, wordOf(to, { x, y }))) continue;

      changed++;
      const tx = x + offset.x;
      const ty = y + offset.y;

      if (tx >= 0 && ty >= 0 && tx < to.width && ty < to.height && !pixelsDiffer(word, wordOf(to, { x: tx, y: ty })))
        matched++;
    }

  return changed > 0 && matched / changed >= MOVE_MATCH;
};

const PROFILE_SHIFTS = 3;

const edgeProfileOf = (picture: Picture, { box, axis }: { box: ChangedBox; axis: 'x' | 'y' }) => {
  const profile = new Int32Array(axis === 'x' ? box.width : box.height);

  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x + 1; x < box.x + box.width; x++)
      if (pixelsDiffer(wordOf(picture, { x, y }), wordOf(picture, { x: x - 1, y }))) {
        const at = axis === 'x' ? x - box.x : y - box.y;

        profile[at] = (profile[at] ?? 0) + 1;
      }

  return profile;
};

const bestShiftsOf = (from: Int32Array, to: Int32Array) => {
  const scored: { shift: number; score: number }[] = [];

  for (let shift = -from.length + 1; shift < to.length; shift++) {
    let score = 0;

    for (let index = Math.max(0, -shift); index < from.length && index + shift < to.length; index++) {
      const one = from[index] ?? 0;
      const other = to[index + shift] ?? 0;

      score += Math.min(one, other) - Math.abs(one - other);
    }

    scored.push({ shift, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, PROFILE_SHIFTS)
    .map(({ shift }) => shift);
};

const offsetsOf = (pictures: { before: Picture; after: Picture }, { from, to }: ChangeMove) => {
  const shifts = (axis: 'x' | 'y') =>
    bestShiftsOf(
      edgeProfileOf(pictures.before, { box: from, axis }),
      edgeProfileOf(pictures.after, { box: to, axis }),
    ).map((shift) => to[axis] - from[axis] + shift);
  const xs = new Set([to.x - from.x, to.x + to.width - from.x - from.width, ...shifts('x')]);
  const ys = new Set([to.y - from.y, to.y + to.height - from.y - from.height, ...shifts('y')]);

  return [...xs].flatMap((x) => [...ys].map((y) => ({ x, y })));
};

const alikeInSize = (a: ChangedBox, b: ChangedBox) =>
  Math.abs(a.width - b.width) <= Math.max(a.width, b.width) * MOVE_SIZE_SLACK &&
  Math.abs(a.height - b.height) <= Math.max(a.height, b.height) * MOVE_SIZE_SLACK;

const movesOf = ({ before, after }: { before: Picture; after: Picture }, areas: ChangedBox[]) => {
  const moves: ChangeMove[] = [];
  const taken = new Set<ChangedBox>();

  for (const [index, one] of areas.entries())
    for (const other of areas.slice(index + 1)) {
      if (taken.has(one) || taken.has(other) || !alikeInSize(one, other)) continue;

      const [from, to] = busynessOf(before, one) >= busynessOf(before, other) ? [one, other] : [other, one];
      const moved = offsetsOf({ before, after }, { from, to }).some(
        (offset) =>
          carriesOver({ from: before, to: after }, { box: from, offset }) &&
          carriesOver({ from: after, to: before }, { box: to, offset: { x: -offset.x, y: -offset.y } }),
      );

      if (!moved) continue;

      moves.push({ from, to });
      taken.add(one).add(other);
    }

  return moves;
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
    const cells = new Map<number, Bounds>();
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
        const cell = Math.floor(y / REGION_CELL) * columns + Math.floor(x / REGION_CELL);
        const bounds = cells.get(cell);

        if (bounds) {
          bounds[0] = Math.min(bounds[0], x);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = y;
        } else cells.set(cell, [x, y, x, y]);
      }

    if (pixels === 0) return null;

    const regions = regionBoxesOf(cells, columns);
    const areas = changedAreasOf(regions);
    const moves = movesOf({ before: left, after: right }, areas);

    return {
      width,
      height,
      box: { x: leftmost, y: top, width: rightmost - leftmost + 1, height: bottom - top + 1 },
      pixels,
      regions: regions.length,
      areas,
      ...(moves.length > 0 ? { moves } : {}),
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

/**
 * How many pixels of `after` differ from `before` by the tolerance of `looksTheSame` and match no pixel of `before`
 * within `reach` px, or the other way round, whichever is more; counting stops at `limit`. A part that only moves by
 * up to `reach` px counts next to nothing. `limit` when the pictures differ in size or do not decode.
 */
export const visibleChangeOf = (
  pair: { before: Buffer; after: Buffer },
  { reach, limit }: { reach: number; limit: number },
) => {
  const { before, after } = pair;

  try {
    const left = decodePng(before);
    const right = decodePng(after);

    if (left.width !== right.width || left.height !== right.height) return limit;

    const { width, height } = left;
    const wordAt = (data: Buffer, at: { x: number; y: number }) => data.readUInt32BE((at.y * width + at.x) * 4);
    const unmatched = (from: Buffer, to: Buffer) => {
      let count = 0;

      for (let y = 0; y < height && count < limit; y++)
        for (let x = 0; x < width && count < limit; x++) {
          const word = wordAt(to, { x, y });

          if (!pixelsDiffer(wordAt(from, { x, y }), word)) continue;

          let matched = false;

          for (let ny = Math.max(0, y - reach); ny <= Math.min(height - 1, y + reach) && !matched; ny++)
            for (let nx = Math.max(0, x - reach); nx <= Math.min(width - 1, x + reach) && !matched; nx++)
              matched = !pixelsDiffer(wordAt(from, { x: nx, y: ny }), word);

          if (!matched) count++;
        }

      return count;
    };

    return Math.max(unmatched(left.data, right.data), unmatched(right.data, left.data));
  } catch {
    return limit;
  }
};
