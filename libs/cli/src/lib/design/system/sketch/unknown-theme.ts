import { PictureOf } from '../../merge-compare';
import { readPartModule } from '../list-system';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { overlaySketch } from './overlay';
import { rejectionOf, Sketch } from './sketch';
import { defaultFrameOf, SketchPartLoader } from './unchanged-states';

const RUNTIME_THEMES = ['inherited'];

const themesIn = (text: string) => [...text.matchAll(/\.et-color--([\w-]+)/g)].map((match) => match[1] as string);

/** The colour theme names a CSS text defines with a `.et-color--<name>` selector. */
export const definedThemesIn = (css: string[]) => [...new Set(css.flatMap(themesIn))].sort();

/** The colour theme names a markup uses in a `class` attribute, without the SDK's `inherited` marker. */
export const usedThemesIn = (markup: string) =>
  [
    ...new Set(
      [...markup.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
        .flatMap((match) => (match[1] ?? match[2] ?? '').split(/\s+/))
        .filter((name) => name.startsWith('et-color--'))
        .map((name) => name.slice('et-color--'.length)),
    ),
  ]
    .filter((name) => name !== '' && !RUNTIME_THEMES.includes(name))
    .sort();

/** The sentence for a colour theme name no foundation defines, naming the ones that are defined. */
export const unknownThemeSentenceOf = (unknown: string[], defined: string[]) =>
  `${unknown.map((name) => `et-color--${name}`).join(', ')}, which no foundation of the product defines, so ` +
  `${unknown.length === 1 ? 'it draws' : 'they draw'} in the accent; ` +
  (defined.length > 0
    ? `defined: ${defined.join(', ')} - use one of them or add the theme to the colors foundation`
    : 'the product defines no named theme - add the theme to the colors foundation');

/**
 * One warning per target of a live variant whose states use an `et-color--<name>` class no foundation of the variant's
 * product defines, naming the defined ones.
 */
export const unknownThemeWarningsOf = async (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  load: SketchPartLoader;
  pictureOf: PictureOf;
}): Promise<string[]> => {
  const { product, sketch, load, pictureOf } = options;
  const warnings: string[] = [];

  for (const variant of sketch.variants.filter((entry) => !rejectionOf(sketch, entry)))
    for (const target of sketch.targets) {
      const sketched = overlaySketch({ product, sketch, variant });
      const part = sketched.parts.find((entry) => partKeyOf(entry) === target);

      if (!part) continue;

      const defined = definedThemesIn(
        sketched.parts.filter((entry) => entry.layer === 'foundations').map((entry) => entry.cssSource ?? ''),
      );
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
      const unknown = new Set<string>();

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

        for (const name of usedThemesIn(markup)) if (!defined.includes(name)) unknown.add(name);
      }

      if (unknown.size > 0)
        warnings.push(
          `${sketch.target} ${variant}: ${target} uses ${unknownThemeSentenceOf([...unknown].sort(), defined)}`,
        );
    }

  return warnings;
};
