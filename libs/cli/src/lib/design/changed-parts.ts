import { resolve } from 'path';
import { DesignConfig } from './paths';
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

/** The parts a file change redraws, or every part when the server cannot tell. */
export type PartsChange = { all: true } | { all: false; parts: DrawnPart[] };

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
