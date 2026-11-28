import { partDependenciesOf } from '../imports';
import { isLayer, LAYER_USES, mayUse } from '../layers';
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

/** The stated differences of the sub-parts `variant` marks, or of its targets, from the existing parts they match. */
export const notRebuildsOf = (sketch: Pick<Sketch, 'variantInfo'>, variant: string) =>
  sketch.variantInfo[variant]?.notRebuilds ?? [];

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

const TEXT_VALUE = /(?<=<\/?[a-z][\w-]*(?:\s[^<>]*)?>[^<>`]*)\$\{\s*[\w$]+(?:\??\.[\w$]+)*\s*\}/gu;

const IMPORT = /import\s+(?:type\s+)?([\w$\s{},*]+?)\s+from\s/gu;

const importedNamesOf = (source: string) =>
  new Set(
    [...source.matchAll(IMPORT)].flatMap(([, names = '']) =>
      names
        .replace(/[{}]/gu, ',')
        .split(',')
        .map(
          (name) =>
            name
              .trim()
              .split(/\s+as\s+/u)
              .pop() ?? '',
        )
        .filter(Boolean),
    ),
  );

const valuePathOf = (value: string) => value.slice(2, -1).trim();

const valueWordsOf = (value: string) =>
  wordsOf((valuePathOf(value).split('.').pop() ?? '').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase());

const CSS_CLASS = /(?<![\w-])\.([a-z][\w-]*)/gu;

const ELEMENT = /(?<!\/)<([a-z][\w-]*)(\s[^<>]*)?>/gu;

const CLASS_ATTRIBUTE = /\bclass="([^"]*)"/u;

const NAME = /^[a-z][a-z0-9-]*$/u;

const isPrefixed = (name: string, partName: string) =>
  NAME.test(name) && name.split('-').length === partName.split('-').length + 1 && name.endsWith(`-${partName}`);

const shapesOf = (match: RegExpExecArray | RegExpMatchArray) => {
  const [, tag = '', attributes = ''] = match;

  return [tag, ...(attributes.match(CLASS_ATTRIBUTE)?.[1] ?? '').split(/\s+/u)].map((name) => ({ tag, name }));
};

const rootShapesOf = (existing: ResolvedPart) =>
  new Set(
    [
      ...[...(existing.cssSource ?? '').matchAll(CSS_CLASS)].map(([, name = '']) => name),
      ...[...existing.source.matchAll(ELEMENT)].flatMap((match) => shapesOf(match).map(({ name }) => name)),
    ].filter((name) => isPrefixed(name, existing.name)),
  );

const hasContent = (source: string, match: RegExpExecArray | RegExpMatchArray) =>
  !(match[2] ?? '').trimEnd().endsWith('/') && !source.startsWith('</', (match.index ?? 0) + match[0].length);

/**
 * The first element with content that `part` draws in the root shape of `existing`: a tag or class `existing` renders
 * or styles (`et-badge`) under another prefix (`<span class="tsh-badge">`).
 */
const shapeRebuildOf = (part: ResolvedPart, existing: ResolvedPart) => {
  const roots = rootShapesOf(existing);

  if (roots.size === 0) return null;

  const drawn = [...part.source.matchAll(ELEMENT)]
    .filter((match) => hasContent(part.source, match))
    .flatMap(shapesOf)
    .find(({ name }) => !roots.has(name) && isPrefixed(name, existing.name));

  return drawn ? (drawn.tag === drawn.name ? `<${drawn.tag}>` : `<${drawn.tag} class="${drawn.name}">`) : null;
};

/**
 * The existing parts `part` draws inline: a component or element of `product` outside `targets`, in a layer `part` may
 * use, whose name ends the name of a value `part` renders as the text of an element (`<span>${FIXTURE.badge}</span>`
 * for `badge`), and which `part` neither imports nor draws as an `et-` element. A bare imported value is another part's markup, not inline. An
 * element in the root shape of an existing part is inline too, whatever its text (`<span class="tsh-badge">Serie</span>`).
 * Each comes with the first value or element that matched it.
 */
export const inlineRebuildsOf = (options: { product: ResolvedProduct; targets: string[]; part: ResolvedPart }) => {
  const imported = importedNamesOf(options.part.source);
  const values = [...options.part.source.matchAll(TEXT_VALUE)]
    .map(([value]) => value)
    .filter((value) => !imported.has(valuePathOf(value)));

  return options.product.parts
    .filter(
      (existing) =>
        REUSABLE_LAYERS.has(existing.layer) &&
        (!isLayer(options.part.layer) || mayUse({ from: options.part.layer, to: existing.layer })) &&
        !options.targets.includes(partKeyOf(existing)) &&
        partKeyOf(existing) !== partKeyOf(options.part),
    )
    .flatMap((existing) => {
      const value =
        values.find((text) => endsWith(valueWordsOf(text), wordsOf(existing.name))) ??
        shapeRebuildOf(options.part, existing);

      return value && !embeds(options.part, existing) ? [{ existing, value }] : [];
    });
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

  const inline = held
    .filter((part) => sketch.targets.includes(partKeyOf(part)) || builtKeys.has(partKeyOf(part)))
    .flatMap((part) =>
      inlineRebuildsOf({ product, targets: sketch.targets, part }).flatMap(({ existing: twin, value }): Problem[] => {
        const key = partKeyOf(part);
        const holder = twin.origin === 'base' ? (product.base?.name ?? 'the base') : product.name;
        const of = `${holder}:${twin.name}`;
        const stated = notRebuildsOf(sketch, variant).some((entry) => entry.part === key && entry.of === of);

        if (stated && (sketch.targets.includes(key) || marks.includes(key))) return [];

        return [
          {
            rule: 'SKETCH',
            file: part.file,
            part: key,
            message: `variant ${variant} draws ${value} inline in ${key}, whose name matches ${partKeyOf(twin)} of ${holder} - embed @system/${partKeyOf(twin)}, or state the difference: design sketch sub-part ${sketch.target} ${key} --variant ${variant} --not-rebuild-of ${of} "<what it is that ${twin.name} is not>" --by <model id>`,
          },
        ];
      }),
    );

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

  return [...marked, ...rebuilt, ...inline, ...unmarked];
};
