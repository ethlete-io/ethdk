import { relative, resolve, sep } from 'path';
import { DesignConfig } from './paths';
import { isLayer } from './system/layers';
import { partKeyOf } from './system/resolve-product';
import {
  fileOfModuleId,
  productOfModuleId,
  sketchOfModuleId,
  SketchVariant,
  SystemModules,
} from './system/system-modules';

/** One part as a frame draws it: in a product, or in one variant of one of the product's sketches. */
export type DrawnPart = { product: string; part: string; sketch: SketchVariant | null };

/**
 * The parts a file change redraws, or every part when the server cannot tell. `errored` asks a frame
 * that shows an error to reload too: a new file may be the one it missed.
 */
export type PartsChange = { all: true } | { all: false; parts: DrawnPart[]; errored?: true };

export const ALL_PARTS: PartsChange = { all: true };

const drawnKeyOf = (drawn: DrawnPart) =>
  JSON.stringify([drawn.product, drawn.part, drawn.sketch?.target ?? null, drawn.sketch?.variant ?? null]);

/** Whether `change` redraws `drawn`. */
export const redraws = (change: PartsChange, drawn: DrawnPart) =>
  change.all || change.parts.some((part) => drawnKeyOf(part) === drawnKeyOf(drawn));

const everyPartOf = (system: SystemModules, product: string): DrawnPart[] => [
  ...(system.productOf(product)?.parts ?? []).map((part) => ({ product, part: partKeyOf(part), sketch: null })),
  ...system.sketchesOf(product).flatMap(({ target, variants }) =>
    variants.flatMap((variant) =>
      (system.drawnOf(product, { target, variant })?.parts ?? []).map((part) => ({
        product,
        part: partKeyOf(part),
        sketch: { target, variant },
      })),
    ),
  ),
];

const partOfModuleId = (system: SystemModules, id: string): DrawnPart | null => {
  const product = productOfModuleId(id);

  if (!product) return null;

  const sketch = sketchOfModuleId(id);
  const file = fileOfModuleId(id);
  const part = system.drawnOf(product, sketch)?.parts.find((candidate) => candidate.file === file);

  return part ? { product, part: partKeyOf(part), sketch } : null;
};

/**
 * The parts a change to `file` redraws: every part of a product whose `styles` the file is or feeds,
 * and every part among the modules that import the file, directly or not (`dependents`, which holds
 * the file's own modules too).
 */
export const changedPartsOf = (options: {
  target: string;
  config: DesignConfig;
  system: SystemModules;
  file: string;
  dependents: string[];
}): PartsChange => {
  const { target, config, system, file, dependents } = options;
  const files = new Set([resolve(file), ...dependents.map((id) => resolve(fileOfModuleId(id)))]);
  const styled = Object.entries(config.products ?? {}).flatMap(([product, entry]) =>
    (entry.styles ?? []).some((style) => files.has(resolve(target, style))) ? [product] : [],
  );
  const parts = new Map<string, DrawnPart>();

  for (const drawn of [
    ...styled.flatMap((product) => everyPartOf(system, product)),
    ...dependents.flatMap((id) => partOfModuleId(system, id) ?? []),
  ]) {
    parts.set(drawnKeyOf(drawn), drawn);
  }

  return { all: false, parts: [...parts.values()] };
};

const partFolderOf = (segments: string[]) => {
  const [layer, name, inside] = segments;

  return layer && name && inside !== undefined && isLayer(layer) ? `${layer}/${name}` : null;
};

/**
 * The frames a file that came or went redraws: every part of the product whose part folder holds it,
 * since an `@system/...` import anywhere in the product may now resolve to another file, or the parts
 * of the variant whose folder holds it. A file in no part folder redraws no part, only the frames
 * that show an error.
 */
export const addedPartsOf = (options: {
  designRoot: string;
  baseDirs: string[];
  system: SystemModules;
  file: string;
}) => {
  const { designRoot, baseDirs, system, file } = options;
  const none: PartsChange = { all: false, parts: [], errored: true };
  const inDesign = relative(designRoot, file).split(sep);
  const [product, ...rest] = inDesign;

  if (product && !inDesign[0]?.startsWith('..') && system.productOf(product)) {
    if (rest[0] === 'sketches') {
      const [folder, variant, ...inside] = rest.slice(1);
      const layer = folder?.split('-')[0];

      if (!folder || !variant || inside.length === 0 || !layer || !isLayer(layer)) return none;

      const target = `${layer}/${folder.slice(layer.length + 1)}`;
      const parts = everyPartOf(system, product).filter(
        (drawn) => drawn.sketch?.target === target && drawn.sketch.variant === variant,
      );

      return parts.length > 0 ? ({ all: false, parts } satisfies PartsChange) : none;
    }

    return partFolderOf(rest) ? ({ all: false, parts: everyPartOf(system, product) } satisfies PartsChange) : none;
  }

  const baseDir = baseDirs.find((dir) => file.startsWith(`${dir}${sep}`));

  if (!baseDir || !partFolderOf(relative(baseDir, file).split(sep))) return none;

  return {
    all: false,
    parts: system.products().flatMap((name) => everyPartOf(system, name)),
  } satisfies PartsChange;
};
