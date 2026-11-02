import { createHash } from 'crypto';
import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { framesOf, SketchPartLoader } from './unchanged-states';

type Drawn = { name: string; states: Map<string, string> };

const AKTUELL = 'Aktuell';

const drawingOf = async (options: {
  product: ResolvedProduct;
  part: string;
  file: string;
  sketch: SketchVariant | null;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<Map<string, string> | null> => {
  const { product, part, file, sketch, load, pictureOf } = options;
  const read = await readPartModule({
    part: { file },
    product: product.name,
    load: () => load({ file, product: product.name, sketch }),
  });

  if (read.problem) return null;

  const layer = product.parts.find((entry) => partKeyOf(entry) === part)?.layer ?? part.split('/')[0];
  const frames = framesOf(
    { widths: 'widths' in read ? read.widths : undefined, interactions: read.interactions },
    layer === 'pages' ? Object.keys(product.presets) : null,
  );
  const states = new Map<string, string>();

  for (const state of read.states) {
    try {
      const pictures = await Promise.all(
        frames.map((frame) =>
          pictureOf({ product: product.name, part, state, ...frame, sketch, params: new URLSearchParams() }),
        ),
      );
      const hash = createHash('sha256');

      frames.forEach((frame, index) => hash.update(JSON.stringify(frame)).update(pictures[index]?.png ?? ''));
      states.set(state, hash.digest('hex'));
    } catch {
      continue;
    }
  }

  return states;
};

const sameInEveryState = (drawn: Drawn, other: Drawn) =>
  drawn.states.size > 0 && [...drawn.states].every(([state, hash]) => other.states.get(state) === hash);

const firstChangeOf = (drawn: Drawn, current: Drawn | null) =>
  [...drawn.states]
    .map(([state, hash]) => ({ state, hash }))
    .find(({ state, hash }) => current?.states.get(state) !== hash) ?? null;

const likeOf = (drawn: Drawn) => (drawn.name === AKTUELL ? AKTUELL : `variant ${drawn.name}`);

const refusalsOf = (options: { variants: Drawn[]; current: Drawn | null; of: string }): string[] => {
  const { variants, current, of } = options;
  const refusals: string[] = [];

  variants.forEach((drawn, index) => {
    const earlier = variants.slice(0, index);
    const later = variants
      .slice(index + 1)
      .filter((other) => !(sameInEveryState(other, drawn) && sameInEveryState(drawn, other)));
    const others = [...earlier, ...later, ...(current && variants.length > 1 ? [current] : [])];
    const twin = others.find((other) => sameInEveryState(drawn, other));

    if (!twin) {
      if (current && sameInEveryState(drawn, current)) return;

      const shown = firstChangeOf(drawn, current);
      const like = earlier
        .map((other) => ({ other, first: firstChangeOf(other, current) }))
        .find(({ first }) => first !== null && first.hash === shown?.hash);

      if (shown && like?.first)
        refusals.push(
          `variant ${drawn.name}${of} first changes ${shown.state}, which draws the same pixels as ${likeOf(like.other)} draws at its first change ${like.first.state}, so the Studio sketch view shows identical frames - make a state that draws differently the first changed state of variant ${drawn.name}`,
        );

      return;
    }

    refusals.push(
      `variant ${drawn.name}${of} draws the same pixels as ${likeOf(twin)} in every state (${[...drawn.states.keys()].join(', ')}) - it adds nothing visible: change it or reject it`,
    );
  });

  return refusals;
};

/**
 * One line per live variant of the sketch that draws every state of a target pixel for pixel like another live
 * variant, or like the product's part when the sketch has more than one live variant. Of two variants that draw
 * alike in every state, only the later one is named. A lone variant like the product is a change without a visible
 * difference, which `sketch ready` merges on its own, so it is never named. A state that fails to draw counts as
 * different. Any other variant is named when its first changed state, in its own state order, draws like the first
 * changed state of an earlier variant.
 */
export const identicalRenderLinesOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const lines: string[] = [];

  for (const part of sketch.targets) {
    const variants: Drawn[] = [];

    for (const variant of live) {
      const file = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === part)?.file;
      const drawn = file
        ? await drawingOf({ product, part, file, sketch: { target: sketch.target, variant }, load, pictureOf })
        : null;

      if (drawn) variants.push({ name: variant, states: drawn });
    }

    const file = product.parts.find((entry) => partKeyOf(entry) === part)?.file;
    const now = file ? await drawingOf({ product, part, file, sketch: null, load, pictureOf }) : null;
    const of = sketch.targets.length > 1 ? ` ${part}` : '';

    refusalsOf({ variants, current: now ? { name: AKTUELL, states: now } : null, of }).forEach((line) =>
      lines.push(`${sketch.target} ${line}`),
    );
  }

  return lines;
};
