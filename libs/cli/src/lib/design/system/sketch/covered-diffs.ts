import { decodePng, PixelCompare } from '../part-compare';
import { parseTarget, Sketch, sketchIdOf, writeSketchFile } from './sketch';

export type CoverBox = { x: number; y: number; width: number; height: number };
export type Cover = { part: string | null; state: string; box: CoverBox | null };

const BOX = /^(\d+),(\d+),(\d+),(\d+)$/u;

/**
 * Reads a `covers` entry: `<state>` covers the whole state, `<state>@<x>,<y>,<w>,<h>` only that box of its picture.
 * `<layer>/<name>:` in front names the part; a sketch with several targets needs it.
 */
export const parseCover = (entry: string): Cover | string => {
  const at = entry.lastIndexOf('@');
  const head = (at === -1 ? entry : entry.slice(0, at)).trim();
  const colon = head.indexOf(':');
  const qualified = colon !== -1 && head.slice(0, colon).includes('/');
  const part = qualified ? head.slice(0, colon).trim() : null;
  const state = (qualified ? head.slice(colon + 1) : head).trim();

  if (state === '')
    return `"${entry}" names no state - use <layer>/<name>:<state> or <layer>/<name>:<state>@<x>,<y>,<w>,<h>`;
  if (part !== null && typeof parseTarget(part) === 'string')
    return `"${entry}" names no part - write <layer>/<name>:<state>`;
  if (at === -1) return { part, state, box: null };

  const match = BOX.exec(entry.slice(at + 1).trim());
  const [x, y, width, height] = (match?.slice(1) ?? []).map(Number);

  if (x === undefined || y === undefined || !width || !height)
    return `"${entry}" has no region - write <state>@<x>,<y>,<w>,<h> in pixels of the state's picture, w and h above 0`;

  return { part, state, box: { x, y, width, height } };
};

/** Why the entries cannot be a cover of the sketch's parts, or `null`: with several targets every entry names its part. */
export const coverPartProblemOf = (options: { sketch: Sketch; covers: readonly string[] }) => {
  const { sketch } = options;

  for (const entry of options.covers) {
    const cover = parseCover(entry);

    if (typeof cover === 'string') continue;

    if (cover.part === null && sketch.targets.length > 1)
      return `"${entry}" names no part - ${sketch.target} has ${sketch.targets.length} targets (${sketch.targets.join(', ')}), so write <layer>/<name>:${entry.trim()}`;

    if (cover.part !== null && !sketch.targets.includes(cover.part))
      return `"${entry}" names ${cover.part}, which ${sketch.target} does not target (${sketch.targets.join(', ')})`;
  }

  return null;
};

const RED = 0xff0000ff;

const insideAny = (boxes: readonly CoverBox[], point: { x: number; y: number }) =>
  boxes.some(
    (box) => point.x >= box.x && point.y >= box.y && point.x < box.x + box.width && point.y < box.y + box.height,
  );

const differsOnlyInside = (diff: Buffer, boxes: readonly CoverBox[]) => {
  const { width, height, data } = decodePng(diff);
  const words = new Uint32Array(Uint8Array.from(data).buffer);

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) if (words[y * width + x] === RED && !insideAny(boxes, { x, y })) return false;

  return true;
};

const coversResult = (covers: readonly Cover[], result: PixelCompare) => {
  if (covers.some((cover) => cover.box === null)) return true;
  if (result.kind !== 'diff') return false;

  return differsOnlyInside(
    result.diff,
    covers.flatMap((cover) => (cover.box ? [cover.box] : [])),
  );
};

/**
 * The id of the open sketch of `part` whose `covers` take the DIFF of `state`; `null` when none does or its pick is
 * made. A region cover takes it only when every differing pixel lies in one of the state's boxes, at the same size.
 */
export const coveringSketchOf = (options: {
  sketches: readonly Sketch[];
  part: string;
  state: string;
  result: PixelCompare;
}) => {
  const found = options.sketches.find((sketch) => {
    if (sketch.decision !== undefined || !sketch.targets.includes(options.part)) return false;

    const covers = (sketch.covers ?? [])
      .map(parseCover)
      .filter(
        (cover): cover is Cover =>
          typeof cover !== 'string' &&
          cover.state === options.state &&
          (cover.part === null ? sketch.targets.length === 1 : cover.part === options.part),
      );

    return covers.length > 0 && coversResult(covers, options.result);
  });

  if (!found) return null;

  const target = parseTarget(found.target);

  return typeof target === 'string' ? found.target : sketchIdOf(target);
};

/** Replaces the `covers` of an open sketch; no entry clears them. */
export const editCovers = (options: { sketch: Sketch; covers: readonly string[] }): Sketch | string => {
  const { sketch } = options;

  if (sketch.decision !== undefined)
    return `${sketch.target} has a pick - an open sketch covers DIFFs, a picked one does not`;

  const problem = options.covers.map(parseCover).find((cover): cover is string => typeof cover === 'string');

  if (problem !== undefined) return problem;

  const partProblem = coverPartProblemOf({ sketch, covers: options.covers });

  if (partProblem !== null) return partProblem;

  const edited: Sketch = { ...sketch, covers: [...new Set(options.covers.map((cover) => cover.trim()))] };

  writeSketchFile(edited);

  return edited;
};

/** The line `compare` prints for a DIFF an open sketch covers (ADR 0222). */
export const coveredLineOf = (line: string, sketch: string) => `${line} (covered by open sketch ${sketch}, ADR 0222)`;
