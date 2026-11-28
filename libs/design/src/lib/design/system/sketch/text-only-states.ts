import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { comparePixelPair } from './pixel-pair';
import { rejectionOf, Sketch } from './sketch';
import { defaultFrameOf, SketchPartLoader } from './unchanged-states';

/** The fewest states of one part that make a text-only copy group; two are left to the look-alike checks. */
export const TEXT_ONLY_MIN_COPIES = 3;

type Shot = { state: string; picture: Buffer; textless: Buffer };

const sameOf = async (one: Buffer, other: Buffer) => (await comparePixelPair(one, other)).same;

/**
 * Groups of at least `TEXT_ONLY_MIN_COPIES` states whose pictures differ but come out pixel-equal once their text is
 * emptied: each only changes its words and draws nothing of its own.
 */
export const textOnlyGroupsOf = async (shots: Shot[]): Promise<string[][]> => {
  const left = [...shots];
  const groups: string[][] = [];

  while (left.length > 0) {
    const [one] = left.splice(0, 1) as [Shot];
    const same: Shot[] = [];

    for (const two of left) if (await sameOf(one.textless, two.textless)) same.push(two);
    for (const shot of same) left.splice(left.indexOf(shot), 1);

    const group = [one, ...same];
    const differ = (await Promise.all(group.map(async (two) => !(await sameOf(one.picture, two.picture))))).some(
      Boolean,
    );

    if (group.length >= TEXT_ONLY_MIN_COPIES && differ) groups.push(group.map((shot) => shot.state));
  }

  return groups;
};

/**
 * One warning per group of states of a target of a live variant that draw the same picture under other words, in the
 * part's default frame, with how to fix it. `[]` when every state draws something of its own.
 */
export const textOnlyStateWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const warnings: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry)))
    for (const target of sketch.targets) {
      const part = overlaySketch({ product, sketch, variant }).parts.find((entry) => partKeyOf(entry) === target);

      if (!part) continue;

      const on = { target: sketch.target, variant };
      const read = await readPartModule({
        part: { file: part.file },
        product: product.name,
        load: () => load({ file: part.file, product: product.name, sketch: on }),
      });

      if (read.problem || read.states.length < TEXT_ONLY_MIN_COPIES) continue;

      const presets = part.layer === 'pages' ? Object.keys(product.presets) : null;
      const frame = defaultFrameOf(
        { widths: 'widths' in read ? read.widths : undefined, interactions: read.interactions },
        presets,
      );
      const shot = async (state: string, textless: boolean) => {
        const params = new URLSearchParams(textless ? { textless: '1' } : {});

        return (await pictureOf({ product: product.name, part: target, state, ...frame, sketch: on, params })).png;
      };
      const drawn = await Promise.all(
        read.states.map(async (state): Promise<Shot | null> => {
          try {
            return { state, picture: await shot(state, false), textless: await shot(state, true) };
          } catch {
            return null;
          }
        }),
      );

      for (const group of await textOnlyGroupsOf(drawn.filter((entry) => entry !== null)))
        warnings.push(
          `TEXT-ONLY ${sketch.target} ${variant}: ${target} states ${group.join(', ')} draw the same picture under other words - ` +
            `give each state its own drawing (the mark, a diagram, a specimen), not a title over a copy`,
        );
    }

  return warnings;
};
