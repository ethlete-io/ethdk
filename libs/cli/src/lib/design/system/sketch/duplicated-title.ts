import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { defaultFrameOf, SketchPartLoader } from './unchanged-states';

/** A file name with one of these words in it is a poster or key art, a picture that carries the title of what it shows. */
const POSTER_WORDS = new Set(['poster', 'plakat', 'cover', 'keyart', 'artwork', 'affiche', 'cartel']);

type MarkupImage = { name: string; alt: string };

const attributeOf = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((value) => value !== undefined) ?? '';

const fileNameOf = (src: string) => {
  const path = src.split(/[?#]/)[0] ?? '';

  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)).replace(/\.[a-z0-9]+$/i, '');
};

const wordsOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/key[-_ ]art/g, 'keyart')
    .split(/[^a-z0-9]+/);

const isPoster = (name: string) => wordsOf(name).some((word) => POSTER_WORDS.has(word));

/** The drawn images of a markup string: the asset file name and the alt text of each `img`. */
export const markupImagesOf = (markup: string): MarkupImage[] =>
  [...markup.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => ({
    name: fileNameOf(attributeOf(tag, 'src')),
    alt: attributeOf(tag, 'alt').trim(),
  }));

/**
 * Whether a markup draws a title of its own, a headline or an image with an alt text, next to a poster or key art
 * image that already carries the title.
 */
export const duplicatesTitleIn = (markup: string) => {
  const images = markupImagesOf(markup);
  const posters = images.filter((image) => isPoster(image.name));
  const hasHeading = /<h[1-6]\b/i.test(markup);

  return posters.length > 0 && (hasHeading || images.some((image) => image.alt !== '' && !isPoster(image.name)));
};

const statesText = (states: string[]) => states.join(', ');

/**
 * One warning per target of a live variant whose states draw a title of their own next to a poster that carries the
 * title, with how to fix it.
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
          `${sketch.target} ${variant}: ${target} ${statesText(doubled)} draws a title of its own next to a poster that ` +
            `already carries the title - drop the separate title and let the picture carry it, or use a backdrop ` +
            `without the title under the title you draw`,
        );
    }

  return warnings;
};
