import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { defaultFrameOf, SketchPartLoader } from './unchanged-states';

const CARRIES_TITLE = 'data-et-carries-title';

type MarkupImage = { carriesTitle: boolean; alt: string };

const attributeOf = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((value) => value !== undefined) ?? '';

const CARRIES_TITLE_ATTRIBUTE = new RegExp(`\\s${CARRIES_TITLE}(?=[\\s=/>])`, 'i');

const markupImagesOf = (markup: string): MarkupImage[] =>
  [...markup.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => ({
    carriesTitle: CARRIES_TITLE_ATTRIBUTE.test(tag),
    alt: attributeOf(tag, 'alt').trim(),
  }));

/**
 * Whether a markup draws a title of its own, a headline or an image with an alt text, next to an image marked with
 * `data-et-carries-title`.
 */
export const duplicatesTitleIn = (markup: string) => {
  const images = markupImagesOf(markup);
  const hasHeading = /<h[1-6]\b/i.test(markup);

  return (
    images.some((image) => image.carriesTitle) &&
    (hasHeading || images.some((image) => image.alt !== '' && !image.carriesTitle))
  );
};

const statesText = (states: string[]) => states.join(', ');

/**
 * One warning per target of a live variant whose states draw a title of their own next to an image marked as carrying
 * the title, with how to fix it.
 */
export const duplicatedTitleWarningsOf = async (options: {
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

      if (read.problem) continue;

      const presets = part.layer === 'pages' ? Object.keys(product.presets) : null;
      const frame = defaultFrameOf(
        { widths: 'widths' in read ? read.widths : undefined, interactions: read.interactions },
        presets,
      );
      const doubled: string[] = [];

      for (const state of read.states) {
        const markup = await pictureOf({
          product: product.name,
          part: target,
          state,
          ...frame,
          sketch: on,
          params: new URLSearchParams(),
          priority: 'low',
        })
          .then((picture) => picture.markup ?? '')
          .catch(() => '');

        if (duplicatesTitleIn(markup)) doubled.push(state);
      }

      if (doubled.length > 0)
        warnings.push(
          `${sketch.target} ${variant}: ${target} ${statesText(doubled)} draws a title of its own next to an image ` +
            `marked ${CARRIES_TITLE} - drop the separate title and let the picture carry it, or swap the picture ` +
            `for one without the title (and drop the marker) under the title you draw`,
        );
    }

  return warnings;
};
