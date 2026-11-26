import { PictureOf } from '../../merge-compare';
import { decodePng } from '../part-compare';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { framesOf, restStatesOf, SketchPartLoader } from './unchanged-states';

/** A channel may differ by this much of 255 and two states still render the same picture; the tolerance of the client-run judge. */
export const SAME_PICTURE_TOLERANCE = 12;

type LoadedPart = { states?: unknown; grid?: unknown; widths?: unknown; interactions?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const sameImage = (a: Buffer, b: Buffer) => {
  if (a.equals(b)) return true;

  try {
    const left = decodePng(a);
    const right = decodePng(b);

    if (left.width !== right.width || left.height !== right.height) return false;

    for (let at = 0; at < left.data.length; at++)
      if (Math.abs(left.data.readUInt8(at) - right.data.readUInt8(at)) > SAME_PICTURE_TOLERANCE) return false;

    return true;
  } catch {
    return false;
  }
};

/**
 * One warning per pair of states of a target of a live variant that render the same picture in every frame, when at
 * least one of the two is an interaction state (a non-rest state of a grid row) and the other is not its rest state, with
 * how to fix it. A state that draws like its own rest state is left to `restLikeStateWarningsOf`.
 */
export const samePictureStateWarningsOf = async (options: {
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
      const names = Object.keys(loaded['states']);
      const interactions = restStatesOf(part.grid, new Set(names));
      const presets = drawnPart.layer === 'pages' ? Object.keys(product.presets) : null;
      const frames = framesOf(part, presets);
      const pictures = await Promise.all(
        names.map((state) =>
          Promise.all(
            frames.map((frame) =>
              pictureOf({
                product: product.name,
                part: target,
                state,
                ...frame,
                sketch: on,
                params: new URLSearchParams(),
                priority: 'low',
              }).then((picture) => picture.png),
            ),
          ).catch(() => null),
        ),
      );

      names.forEach((_, index) => {
        for (let other = index + 1; other < names.length; other++) {
          const one = names[index] as string;
          const two = names[other] as string;
          const shots = pictures[index];
          const seen = pictures[other];

          if (!shots || !seen) continue;
          if (!interactions.has(one) && !interactions.has(two)) continue;
          if (interactions.get(one) === two || interactions.get(two) === one) continue;
          if (!shots.every((png, frame) => sameImage(png, seen[frame] as Buffer))) continue;

          warnings.push(
            `${sketch.target} ${variant}: ${target} ${one} renders the same picture as ${two}; ` +
              `make the states differ or drop one`,
          );
        }
      });
    }

  return warnings;
};
