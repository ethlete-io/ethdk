import { ChangedBox } from '../../contact-sheet';
import { BoxOf } from '../../variant-diff';
import { decodePng, Pixels } from '../part-compare';

const WRAP_WIDTH = 1440;
const MAX_COLUMNS = 4;
const TRANSPOSE_SHARE = 4;
const COLUMN_GAP = 24;
const FIT_PADDING = 16;
const CROP_MARGIN = 24;

/** The default width of the Studio window, from `apps/ethlete-studio/src-tauri/tauri.conf.json`. */
export const STUDIO_WINDOW_WIDTH = 1280;

/** The colour step, out of 255 in one channel, from which a screen pixel counts as visibly different. */
export const VISIBLE_STEP = 32;

/** The fewest visibly different screen pixels at which two variants count as told apart at Studio's fit zoom. */
export const LOOK_ALIKE_PIXELS = 1500;

/** The share of a changed region's screen pixels that tells two variants apart when it is fewer than `LOOK_ALIKE_PIXELS`. */
export const LOOK_ALIKE_SHARE = 0.25;

/**
 * The zoom the Studio sketch view fits a sketch's frames to, by the width rule of `fitScaleOf` in
 * `apps/ethlete-studio/src/app/design-parts/sketches/sketches.component.ts`: one row per variant and Aktuell side by
 * side once a frame is wider than a quarter of the list, else up to four states per row. Without `listWidth` the list
 * is taken as wide as Studio's default window.
 */
export const studioFitZoomOf = (options: { width: number; rows: number; states: number; listWidth?: number }) => {
  const { width, rows, states, listWidth = STUDIO_WINDOW_WIDTH } = options;
  const widest = Math.max(1, width);

  if (widest > listWidth / TRANSPOSE_SHARE)
    return Math.min(1, (listWidth - (rows - 1) * COLUMN_GAP - FIT_PADDING) / (Math.max(1, rows) * widest));

  const columns = Math.max(1, Math.min(MAX_COLUMNS, states, Math.floor(WRAP_WIDTH / widest)));

  return Math.min(1, (listWidth - (columns - 1) * COLUMN_GAP) / (columns * widest));
};

const unionOf = (boxes: readonly ChangedBox[]): ChangedBox => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));

  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - top,
  };
};

/** How much Studio's crop of the changes against Aktuell magnifies a frame `width` wide, as `cropOf` in `sketch-crops.ts`. */
export const cropMagnifyOf = (width: number, changes: readonly ChangedBox[]) => {
  if (changes.length === 0) return 1;

  const box = unionOf(changes);
  const left = Math.max(0, box.x - CROP_MARGIN);
  const right = Math.min(width, box.x + box.width + CROP_MARGIN);

  return right > left ? width / (right - left) : 1;
};

const shrunkOf = (pixels: Pixels, { box, scale }: { box: ChangedBox; scale: number }) => {
  const width = Math.max(1, Math.ceil(box.width * scale));
  const height = Math.max(1, Math.ceil(box.height * scale));
  const sums = new Float64Array(width * height * 3);
  const counts = new Uint32Array(width * height);
  const right = Math.min(pixels.width, box.x + box.width);
  const bottom = Math.min(pixels.height, box.y + box.height);

  for (let y = Math.max(0, box.y); y < bottom; y++) {
    const row = Math.min(height - 1, Math.floor((y - box.y) * scale)) * width;

    for (let x = Math.max(0, box.x); x < right; x++) {
      const cell = row + Math.min(width - 1, Math.floor((x - box.x) * scale));
      const at = (y * pixels.width + x) * 4;

      for (let channel = 0; channel < 3; channel++)
        sums[cell * 3 + channel] = (sums[cell * 3 + channel] as number) + (pixels.data[at + channel] as number);

      counts[cell] = (counts[cell] as number) + 1;
    }
  }

  return { sums, counts };
};

/**
 * The screen pixels of `region` that differ by at least `VISIBLE_STEP` in one channel when both pictures are drawn at
 * `scale`, each screen pixel the average of the picture pixels it covers.
 */
export const visiblePixelsAt = (options: { before: Pixels; after: Pixels; region: ChangedBox; scale: number }) => {
  const { before, after, region, scale } = options;
  const shrunk = Math.min(1, scale);
  const one = shrunkOf(before, { box: region, scale: shrunk });
  const other = shrunkOf(after, { box: region, scale: shrunk });
  let visible = 0;

  for (let cell = 0; cell < one.counts.length; cell++) {
    const left = Math.max(1, one.counts[cell] as number);
    const right = Math.max(1, other.counts[cell] as number);

    for (let channel = 0; channel < 3; channel++) {
      const step = Math.abs(
        (one.sums[cell * 3 + channel] as number) / left - (other.sums[cell * 3 + channel] as number) / right,
      );

      if (step >= VISIBLE_STEP) {
        visible++;
        break;
      }
    }
  }

  return visible;
};

export type LookAlikeState = { shot: Buffer };

export type LookAlikeVariant = { name: string; states: ReadonlyMap<string, LookAlikeState> };

const regionText = (box: ChangedBox) => `${box.width}x${box.height} at ${box.x},${box.y}`;

const lookAlikeNeedOf = (region: ChangedBox, scale: number) =>
  Math.ceil(
    Math.min(
      LOOK_ALIKE_PIXELS,
      LOOK_ALIKE_SHARE * Math.max(1, Math.ceil(region.width * scale)) * Math.max(1, Math.ceil(region.height * scale)),
    ),
  );

/**
 * One warning per pair of `variants` whose shots differ by at least `lookAlikeNeedOf` visibly different pixels at
 * 100 %, but in no state by that many screen pixels at Studio's fit zoom; it names the state and the region in which they differ most. The zoom follows
 * `studioFitZoomOf` for the widest shot and `listWidth`, times `cropMagnifyOf` the changes against `current` when Studio crops to them.
 */
export const lookAlikeWarningsOf = async (options: {
  target: string;
  variants: readonly LookAlikeVariant[];
  current: LookAlikeVariant | null;
  boxOf: BoxOf;
  listWidth?: number;
}): Promise<string[]> => {
  const { target, variants, current, boxOf, listWidth = STUDIO_WINDOW_WIDTH } = options;
  const decoded = new Map<Buffer, Pixels | null>();
  const pixelsOf = (shot: Buffer) => {
    if (!decoded.has(shot))
      try {
        decoded.set(shot, decodePng(shot));
      } catch {
        decoded.set(shot, null);
      }

    return decoded.get(shot) ?? null;
  };
  const shown = [...(current ? [current] : []), ...variants];
  const states = new Set(shown.flatMap((drawn) => [...drawn.states.keys()]));
  const widest = Math.max(
    1,
    ...shown.flatMap((drawn) => [...drawn.states.values()].map((state) => pixelsOf(state.shot)?.width ?? 0)),
  );
  const fit = studioFitZoomOf({ width: widest, rows: shown.length, states: states.size, listWidth });
  const transposed = widest > listWidth / TRANSPOSE_SHARE;
  const scaleOf = async (state: string) => {
    const now = current?.states.get(state);

    if (!transposed || !now) return fit;

    const changes = (
      await Promise.all(
        variants.map((drawn) => {
          const shot = drawn.states.get(state)?.shot;

          return shot ? boxOf(now.shot, shot) : [];
        }),
      )
    ).flat();

    return fit * cropMagnifyOf(widest, changes);
  };
  const warnings: string[] = [];

  for (const [index, one] of variants.entries())
    for (const other of variants.slice(index + 1)) {
      let most: {
        state: string;
        region: ChangedBox;
        visible: number;
        need: number;
        scale: number;
        before: Pixels;
        after: Pixels;
      } | null = null;

      for (const [state, { shot }] of one.states) {
        const otherShot = other.states.get(state)?.shot;
        const before = pixelsOf(shot);
        const after = otherShot ? pixelsOf(otherShot) : null;

        if (!otherShot || !before || !after) continue;

        const boxes = await boxOf(shot, otherShot);

        if (boxes.length === 0) continue;

        const region = unionOf(boxes);
        const scale = Math.min(1, await scaleOf(state));
        const visible = visiblePixelsAt({ before, after, region, scale });
        const need = lookAlikeNeedOf(region, scale);

        if (!most || visible / need > most.visible / most.need)
          most = { state, region, visible, need, scale, before, after };
      }

      if (!most || most.visible >= most.need) continue;

      const { before, after, region } = most;
      const full = visiblePixelsAt({ before, after, region, scale: 1 });

      if (full >= lookAlikeNeedOf(region, 1))
        warnings.push(
          `${target}: WARNING variants ${one.name} and ${other.name} look alike at Studio's fit zoom (${Math.round(most.scale * 100)} %): ` +
            `they differ most in ${most.state}, region ${regionText(region)}, by ${most.visible} visible screen pixels ` +
            `(${full} at 100 %), fewer than ${most.need} - draw the difference larger`,
        );
    }

  return warnings;
};

/** The share of the frame area below which two variants count as alike in a state their round asks its question in. */
export const ALIKE_SHARE = 0.02;

export type AskingRound = { variants: readonly LookAlikeVariant[]; asks?: readonly string[] };

/**
 * The states a round asks its question in: its own `asks`, else the states its variants draw that `current` lacks,
 * else the states in which one of its variants draws differently from `current`.
 */
export const askedStatesOf = async (options: {
  round: AskingRound;
  current: LookAlikeVariant | null;
  boxOf: BoxOf;
}): Promise<string[]> => {
  const { round, current, boxOf } = options;

  if (round.asks && round.asks.length > 0) return [...round.asks];

  const drawn = [...new Set(round.variants.flatMap((variant) => [...variant.states.keys()]))];
  const added = drawn.filter((state) => !current?.states.has(state));

  if (added.length > 0 || !current) return added;

  const changed: string[] = [];

  for (const state of drawn) {
    const before = current.states.get(state)?.shot;

    for (const variant of round.variants) {
      const after = variant.states.get(state)?.shot;

      if (before && after && (await boxOf(before, after)).length > 0) {
        changed.push(state);
        break;
      }
    }
  }

  return changed;
};

/**
 * One refusal per pair of variants of a round whose shots differ, in one of the states the round asks its question in
 * (`askedStatesOf`), by fewer visibly different pixels at 100 % than `ALIKE_SHARE` of the frame area; it names the
 * state in which they differ least. A pair `twins` answers true for is left out.
 */
export const alikePairLinesOf = async (options: {
  target: string;
  rounds: readonly AskingRound[];
  current: LookAlikeVariant | null;
  boxOf: BoxOf;
  twins?: (one: string, other: string) => boolean;
}): Promise<string[]> => {
  const { target, rounds, current, boxOf, twins } = options;
  const decoded = new Map<Buffer, Pixels | null>();
  const pixelsOf = (shot: Buffer) => {
    if (!decoded.has(shot))
      try {
        decoded.set(shot, decodePng(shot));
      } catch {
        decoded.set(shot, null);
      }

    return decoded.get(shot) ?? null;
  };
  const lines: string[] = [];

  for (const round of rounds) {
    if (round.variants.length < 2) continue;

    const asked = await askedStatesOf({ round, current, boxOf });

    for (const [index, one] of round.variants.entries())
      for (const other of round.variants.slice(index + 1)) {
        if (twins?.(one.name, other.name)) continue;

        let least: { state: string; visible: number; share: number } | null = null;

        for (const state of asked) {
          const shot = one.states.get(state)?.shot;
          const otherShot = other.states.get(state)?.shot;
          const before = shot ? pixelsOf(shot) : null;
          const after = otherShot ? pixelsOf(otherShot) : null;

          if (!shot || !otherShot || !before || !after) continue;

          const boxes = await boxOf(shot, otherShot);
          const visible = boxes.length === 0 ? 0 : visiblePixelsAt({ before, after, region: unionOf(boxes), scale: 1 });
          const share =
            visible / Math.max(1, Math.max(before.width, after.width) * Math.max(before.height, after.height));

          if (!least || share < least.share) least = { state, visible, share };
        }

        if (least && least.share < ALIKE_SHARE)
          lines.push(
            `${target}: variants ${one.name} and ${other.name} look alike in ${least.state} ` +
              `(${least.visible} px, ${(least.share * 100).toFixed(1)} % of the frame, under ${ALIKE_SHARE * 100} %) - ` +
              `draw the difference larger or name other --asks states`,
          );
      }
  }

  return lines;
};
