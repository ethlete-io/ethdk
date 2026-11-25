import { partDependenciesOf } from '../imports';
import { isLayer, LAYER_USES } from '../layers';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { isEditSketch } from './merged-parts';
import { SketchedProduct } from './overlay';
import { Sketch, variantDirOf } from './sketch';

const REUSABLE_LAYERS = new Set(['components', 'elements']);
const COMPOSITION_LAYERS = new Set(['elements', 'pages']);

/** The `<layer>/<name>` keys of the new parts `variant` builds that its agent marked as sub-parts. */
export const subPartsOf = (sketch: Pick<Sketch, 'variantInfo'>, variant: string) =>
  sketch.variantInfo[variant]?.subParts ?? [];

/** Why a sketch on `targets` cannot mark `key` as a sub-part, or `null` when it can. */
/** The stated differences of the sub-parts `variant` marks from the existing parts their names match. */
export const notRebuildsOf = (sketch: Pick<Sketch, 'variantInfo'>, variant: string) =>
  sketch.variantInfo[variant]?.notRebuilds ?? [];

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
 * The problems of the sub-parts of `variant`: a marked key that is no new part the variant builds; every new part whose
 * name matches an existing part of the product or its base, unless it embeds that part or is marked with a stated
 * difference; and, in a composition, every new part it does not mark.
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
  const marks = subPartsOf(sketch, variant);
  const rebuilt = built.flatMap((part): Problem[] => {
    const twin = rebuiltPartOf({ product, targets: sketch.targets, part });

    if (!twin) return [];

    const key = partKeyOf(part);
    const holder = twin.origin === 'base' ? (product.base?.name ?? 'the base') : product.name;
    const of = `${holder}:${twin.name}`;
    const stated = notRebuildsOf(sketch, variant).some((entry) => entry.part === key && entry.of === of);

    if (stated && marks.includes(key)) return [];

    return [
      {
        rule: 'SKETCH',
        file: part.file,
        part: key,
        message: `variant ${variant} builds ${key}, whose name matches ${partKeyOf(twin)} of ${holder} - embed @system/${partKeyOf(twin)}, or state the difference: design sketch sub-part ${sketch.target} ${key} --variant ${variant} --not-rebuild-of ${of} "<what it is that ${twin.name} is not>" --by <model id>`,
      },
    ];
  });

  const rebuiltKeys = new Set(rebuilt.flatMap((problem) => problem.part ?? []));
  const unmarked =
    isEditSketch(sketch) || !sketch.targets.every((key) => COMPOSITION_LAYERS.has(key.split('/')[0] ?? ''))
      ? []
      : built
          .filter(
            (part) =>
              !marks.includes(partKeyOf(part)) &&
              !rebuiltKeys.has(partKeyOf(part)) &&
              subPartKeyProblemOf({ targets: sketch.targets, key: partKeyOf(part) }) === null,
          )
          .map((part): Problem => ({
            rule: 'SKETCH',
            file: part.file,
            part: partKeyOf(part),
            message: `variant ${variant} builds ${partKeyOf(part)}, a new part it does not mark - mark it with design sketch sub-part ${sketch.target} ${partKeyOf(part)} --variant ${variant} --by <model id>`,
          }));

  return [...marked, ...rebuilt, ...unmarked];
};
