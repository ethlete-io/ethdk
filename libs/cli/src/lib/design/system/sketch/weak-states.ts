import { PictureOf } from '../../merge-compare';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { looksTheSame, visibleChangeOf } from './change-box';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { framesOf, restStatesOf, SketchPartLoader } from './unchanged-states';

/** A state shifted by up to this many px against its rest state is no visible change. */
export const WEAK_STATE_REACH = 4;

/** Fewer changed px than this, beyond a shift of `WEAK_STATE_REACH`, is a state that barely differs from rest. */
export const WEAK_STATE_PIXELS = 32;

type LoadedPart = { states?: unknown; grid?: unknown; widths?: unknown; interactions?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The largest change of `state` against `rest` over the frames of `part`; `null` when every frame draws the same. */
const changeOf = async (options: {
  pictureOf: PictureOf;
  product: string;
  key: string;
  part: LoadedPart;
  presets: string[] | null;
  state: string;
  rest: string;
  sketch: { target: string; variant: string };
}) => {
  const { pictureOf, product, key, part, presets, state, rest, sketch } = options;
  const draw = (drawn: string, frame: ReturnType<typeof framesOf>[number]) =>
    pictureOf({ product, part: key, state: drawn, ...frame, sketch, params: new URLSearchParams(), priority: 'low' });
  const changes = await Promise.all(
    framesOf(part, presets).map(async (frame) => {
      const [before, after] = await Promise.all([draw(rest, frame), draw(state, frame)]);

      return looksTheSame(before.png, after.png)
        ? null
        : visibleChangeOf(
            { before: before.png, after: after.png },
            { reach: WEAK_STATE_REACH, limit: WEAK_STATE_PIXELS },
          );
    }),
  );
  const drawn = changes.filter((change): change is number => change !== null);

  return drawn.length === 0 ? null : Math.max(...drawn);
};

/**
 * One warning per state of a target of a live variant that differs from its row's `rest` state in some frame, but in
 * no frame by `WEAK_STATE_PIXELS` px or more beyond a shift of `WEAK_STATE_REACH` px, with how to fix it. A state that
 * draws the same as rest is left to `restLikeStateWarningsOf`.
 */
export const weakStateWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const warnings: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry)))
    for (const target of sketch.targets) {
      const drawnPart = overlaySketch({ product, sketch, variant }).parts.find((part) => partKeyOf(part) === target);

      if (!drawnPart) continue;

      const on = { target: sketch.target, variant };
      const loaded = (
        (await load({ file: drawnPart.file, product: product.name, sketch: on }).catch(() => null)) as {
          default?: unknown;
        } | null
      )?.default;

      if (!isRecord(loaded) || !isRecord(loaded['states'])) continue;

      const part = loaded as LoadedPart;
      const presets = drawnPart.layer === 'pages' ? Object.keys(product.presets) : null;
      const rests = [...restStatesOf(part.grid, new Set(Object.keys(loaded['states'])))];
      const changes = await Promise.all(
        rests.map(([state, rest]) =>
          changeOf({ pictureOf, product: product.name, key: target, part, presets, state, rest, sketch: on }).catch(
            () => null,
          ),
        ),
      );

      rests.forEach(([state, rest], index) => {
        const change = changes[index];

        if (change === null || change === undefined || change >= WEAK_STATE_PIXELS) return;

        warnings.push(
          `${sketch.target} ${variant}: ${target} ${state} barely differs from its rest state ${rest} - ` +
            `${change} px change beyond a shift of ${WEAK_STATE_REACH} px; a lift or move of a few px, or a change ` +
            `that small, does not read as a state: give ${state} a change the user sees next to ${rest} ` +
            `(colour, surface, outline or shadow)`,
        );
      });
    }

  return warnings;
};
