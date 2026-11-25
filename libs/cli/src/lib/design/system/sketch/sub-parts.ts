import { partDependenciesOf } from '../imports';
import { isLayer, LAYER_USES } from '../layers';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { SketchedProduct } from './overlay';
import { Sketch, variantDirOf } from './sketch';

const REUSABLE_LAYERS = new Set(['components', 'elements']);

/** The `<layer>/<name>` keys of the new parts `variant` builds that its agent marked as sub-parts. */
export const subPartsOf = (sketch: Pick<Sketch, 'variantInfo'>, variant: string) =>
  sketch.variantInfo[variant]?.subParts ?? [];

/** Why a sketch on `targets` cannot mark `key` as a sub-part, or `null` when it can. */
export const subPartKeyProblemOf = (options: { targets: string[]; key: string }) => {
  const [layer = '', name = '', ...rest] = options.key.split('/');

  if (rest.length > 0 || !isLayer(layer) || !/^[a-z0-9][a-z0-9-]*$/u.test(name))
    return `${options.key} is no part key - name a sub-part as <layer>/<name>`;
  if (options.targets.includes(options.key))
    return `${options.key} is a target of the sketch - a sub-part is a new part the target embeds`;
  if (!options.targets.some((target) => LAYER_USES[target.split('/')[0] as keyof typeof LAYER_USES]?.includes(layer)))
    return `a sketch on ${options.targets.join(', ')} cannot embed a part of ${layer}`;

  return null;
};

const singular = (word: string) =>
  word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;

const wordsOf = (name: string) => name.split('-').map(singular);

const endsWith = (words: string[], end: string[]) =>
  end.length <= words.length && end.every((word, index) => words[words.length - end.length + index] === word);

const embeds = (part: ResolvedPart, existing: ResolvedPart) =>
  partDependenciesOf(part).some((imported) => partKeyOf(imported) === partKeyOf(existing)) ||
  new RegExp(`(?<![\\w-])et-${existing.name}(?![\\w-])`, 'u').test(part.source);

/**
 * The existing part `part` builds again: a component or element of `product` outside `targets` whose name ends the
 * name of `part`, singular or plural (`badge` for `hero-badges`), and which `part` neither imports nor draws as an
 * `et-` element.
 */
export const rebuiltPartOf = (options: { product: ResolvedProduct; targets: string[]; part: ResolvedPart }) => {
  const words = wordsOf(options.part.name);

  return (
    options.product.parts
      .filter((existing) => REUSABLE_LAYERS.has(existing.layer) && !options.targets.includes(partKeyOf(existing)))
      .filter((existing) => endsWith(words, wordsOf(existing.name)) && !embeds(options.part, existing))
      .sort((a, b) => b.name.length - a.name.length)[0] ?? null
  );
};

/**
 * The problems of the sub-parts of `variant`: a marked key that is no new part the variant builds, and every new part
 * it builds, marked or not, that rebuilds an existing part of the product or its base.
 */
export const subPartProblemsOf = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
  overlaid: SketchedProduct;
}): Problem[] => {
  const { product, sketch, variant, overlaid } = options;
  const dir = variantDirOf(sketch, variant);
  const existing = new Set(product.parts.map(partKeyOf));
  const held = overlaid.parts.filter((part) => overlaid.sketched.includes(partKeyOf(part)));
  const built = held.filter((part) => !sketch.targets.includes(partKeyOf(part)) && !existing.has(partKeyOf(part)));
  const builtKeys = new Set(built.map(partKeyOf));
  const marked = subPartsOf(sketch, variant).flatMap((key): Problem[] => {
    const invalid = subPartKeyProblemOf({ targets: sketch.targets, key });

    if (invalid) return [{ rule: 'SKETCH', file: dir, message: `variant ${variant} marks a sub-part: ${invalid}` }];
    if (existing.has(key))
      return [
        {
          rule: 'SKETCH',
          file: dir,
          message: `variant ${variant} marks ${key} as a sub-part, but the product has ${key} - a sub-part is a new part; change ${key} in a sketch of its own`,
        },
      ];
    if (!builtKeys.has(key))
      return [
        {
          rule: 'SKETCH',
          file: dir,
          message: `variant ${variant} marks ${key} as a sub-part but builds no ${key} - build it in ${variant}/${key}/ or drop the mark`,
        },
      ];

    return [];
  });
  const rebuilt = built.flatMap((part): Problem[] => {
    const twin = rebuiltPartOf({ product, targets: sketch.targets, part });

    if (!twin) return [];

    const holder = twin.origin === 'base' ? (product.base?.name ?? 'the base') : product.name;

    return [
      {
        rule: 'SKETCH',
        file: part.file,
        part: partKeyOf(part),
        message: `variant ${variant} builds ${partKeyOf(part)}, a rebuild of ${partKeyOf(twin)} of ${holder} - embed @system/${partKeyOf(twin)} instead of building it again`,
      },
    ];
  });

  return [...marked, ...rebuilt];
};
