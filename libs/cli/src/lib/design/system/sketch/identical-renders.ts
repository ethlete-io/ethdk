import { createHash } from 'crypto';
import { PictureOf } from '../../merge-compare';
import { DRAWS_AT_ONCE } from '../../thumb';
import { BoxOf } from '../../variant-diff';
import { inOrderAtOnce } from '../in-order-at-once';
import { lookAlikeWarningsOf } from './look-alike';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchVariant } from '../system-modules';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { framesOf, SketchPartLoader } from './unchanged-states';

type DrawnState = { hash: string; shot: Buffer };

type Drawn = { name: string; states: Map<string, DrawnState> };

const AKTUELL = 'Aktuell';

const drawingOf = async (options: {
  product: ResolvedProduct;
  part: string;
  file: string;
  sketch: SketchVariant | null;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<Map<string, DrawnState> | null> => {
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
  const drawn = await inOrderAtOnce({
    items: read.states,
    limit: DRAWS_AT_ONCE,
    run: async (state): Promise<[string, DrawnState] | null> => {
      try {
        const pictures = await Promise.all(
          frames.map((frame) =>
            pictureOf({ product: product.name, part, state, ...frame, sketch, params: new URLSearchParams() }),
          ),
        );
        const hash = createHash('sha256');

        frames.forEach((frame, index) => hash.update(JSON.stringify(frame)).update(pictures[index]?.png ?? ''));

        return [state, { hash: hash.digest('hex'), shot: pictures[0]?.png ?? Buffer.alloc(0) }];
      } catch {
        return null;
      }
    },
  });

  return new Map(drawn.filter((entry) => entry !== null));
};

const sameInEveryState = (drawn: Drawn, other: Drawn) =>
  drawn.states.size > 0 && [...drawn.states].every(([state, { hash }]) => other.states.get(state)?.hash === hash);

const samePixels = async (boxOf: BoxOf, pair: [DrawnState, DrawnState]) =>
  (await boxOf(pair[0].shot, pair[1].shot)).length === 0;

const firstChangeOf = async (boxOf: BoxOf, pair: { drawn: Drawn; current: Drawn | null }) => {
  for (const [state, picture] of pair.drawn.states) {
    const before = pair.current?.states.get(state);

    if (!before || !(await samePixels(boxOf, [before, picture]))) return { state, picture };
  }

  return null;
};

const likeOf = (drawn: Drawn) => (drawn.name === AKTUELL ? AKTUELL : `variant ${drawn.name}`);

export type IdenticalRender = { variant: string; sibling: string | null; line: string };

const withdrawAdviceOf = (target: string, variant: string) =>
  `withdraw it with \`sketch withdraw ${target} --variant ${variant} --by <model id>\` or redraw it`;

const refusalsOf = async (options: {
  variants: Drawn[];
  current: Drawn | null;
  of: string;
  target: string;
  boxOf: BoxOf;
}): Promise<IdenticalRender[]> => {
  const { variants, current, of, target, boxOf } = options;
  const refusals: IdenticalRender[] = [];

  for (const [index, drawn] of variants.entries()) {
    const earlier = variants.slice(0, index);
    const later = variants
      .slice(index + 1)
      .filter((other) => !(sameInEveryState(other, drawn) && sameInEveryState(drawn, other)));
    const others = [...earlier, ...later, ...(current && variants.length > 1 ? [current] : [])];
    const twin = others.find((other) => sameInEveryState(drawn, other));

    if (!twin) {
      if (current && sameInEveryState(drawn, current)) continue;

      const shown = await firstChangeOf(boxOf, { drawn, current });
      let like: { other: Drawn; first: { state: string } } | undefined;

      for (const other of shown ? earlier : []) {
        const first = await firstChangeOf(boxOf, { drawn: other, current });

        if (shown && first && (await samePixels(boxOf, [first.picture, shown.picture]))) {
          like = { other, first };
          break;
        }
      }

      if (shown && like)
        refusals.push({
          variant: drawn.name,
          sibling: like.other.name === AKTUELL ? null : like.other.name,
          line: `variant ${drawn.name}${of} first changes ${shown.state}, which draws the same pixels as ${likeOf(like.other)} draws at its first change ${like.first.state}, so the Studio sketch view shows identical frames - ${withdrawAdviceOf(target, drawn.name)}`,
        });

      continue;
    }

    refusals.push({
      variant: drawn.name,
      sibling: twin.name === AKTUELL ? null : twin.name,
      line: `variant ${drawn.name}${of} draws the same pixels as ${likeOf(twin)} in every state (${[...drawn.states.keys()].join(', ')}) - it adds nothing visible: ${twin.name === AKTUELL ? 'redraw it' : withdrawAdviceOf(target, drawn.name)}`,
    });
  }

  return refusals;
};

/**
 * One line per live variant of the sketch that draws every state of a target pixel for pixel like another live
 * variant, or like the product's part when the sketch has more than one live variant. Of two variants that draw
 * alike in every state, only the later one is named. A lone variant like the product is a change without a visible
 * difference, which `sketch ready` merges on its own, so it is never named. A state that fails to draw counts as
 * different. Any other variant is named when its first changed state, in its own state order, draws like the first
 * changed state of an earlier variant. "Changed" and "draws like" there are the pixel diff of `design shot` (`boxOf`),
 * at the frame a shot draws: the first preset or width, no interaction.
 */
export const identicalRenderLinesOf = async (options: Parameters<typeof identicalRendersOf>[0]): Promise<string[]> =>
  (await identicalRendersOf(options)).map((render) => render.line);

/**
 * The variants `identicalRenderLinesOf` names, each with the sibling variant it draws like in its first changed state
 * (`null` when it draws like the product's part) and its line, which starts with the sketch's target.
 */
export const identicalRendersOf = async (options: Omit<Parameters<typeof sketchRendersOf>[0], 'lookAlike'>) =>
  (await sketchRendersOf(options)).identical;

/**
 * The variants `identicalRendersOf` names and, with `lookAlike`, the warnings of `lookAlikeWarningsOf` for each target,
 * from one shot of each state.
 */
export const sketchRendersOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
  boxOf: BoxOf;
  lookAlike?: boolean;
  listWidth?: number;
}): Promise<{ identical: IdenticalRender[]; lookAlike: string[] }> => {
  const { product, sketch, load, pictureOf, boxOf } = options;
  const lookAlike: string[] = [];
  const live = sketch.variants.filter((variant) => !rejectionOf(sketch, variant));
  const found: IdenticalRender[] = [];

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

    const current = now ? { name: AKTUELL, states: now } : null;

    if (options.lookAlike)
      lookAlike.push(
        ...(await lookAlikeWarningsOf({
          target: `${sketch.target}${of}`,
          variants,
          current,
          boxOf,
          listWidth: options.listWidth,
        })),
      );

    for (const render of await refusalsOf({ variants, current, of, target: sketch.target, boxOf }))
      found.push({ ...render, line: `${sketch.target} ${render.line}` });
  }

  return { identical: found, lookAlike };
};
