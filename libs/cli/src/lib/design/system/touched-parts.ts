import { existsSync, readFileSync } from 'fs';
import { isAbsolute, relative, resolve } from 'path';
import { addedPartsOf, changedPartsOf, DrawnPart } from '../changed-parts';
import { DESIGN_DIR, DesignConfig } from '../paths';
import { partOfFile } from './check-system';
import { partKeyOf } from './resolve-product';
import { createSystemModules, fileOfModuleId, productModuleIdOf, SystemModules } from './system-modules';
import { importsOf } from './ts-source';

/** One file a push changes, as `git diff --name-status --no-renames` prints it, relative to the checkout. */
export type PrepushChange = { status: 'A' | 'M' | 'D'; file: string };

const SOURCE_FILE = /\.[cm]?tsx?$/u;

const isInside = (dir: string, file: string) => {
  const path = relative(dir, file);

  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
};

/** Each file one product's own drawing reaches, mapped to the module ids that import it. */
const importersOf = (system: SystemModules, product: string) => {
  const drawn = system.drawnOf(product);
  const importers = new Map<string, Set<string>>();

  if (!drawn) return importers;

  const queue = [...drawn.parts.map(({ file }) => file), ...(drawn.fixtures ? [drawn.fixtures] : [])].map((file) =>
    productModuleIdOf({ file, product }),
  );
  const seen = new Set(queue);

  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const file = fileOfModuleId(id);

    if (!SOURCE_FILE.test(file) || !existsSync(file)) continue;

    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const imported = system.resolveId(specifier, id);

      if (!imported) continue;

      const key = resolve(fileOfModuleId(imported));

      importers.set(key, (importers.get(key) ?? new Set()).add(id));

      if (seen.has(imported)) continue;

      seen.add(imported);
      queue.push(imported);
    }
  }

  return importers;
};

/** The module ids of `file` in `product` and of every module that imports it, directly or not. */
const dependentsOf = (options: { importers: Map<string, Set<string>>; product: string; file: string }) => {
  const { importers, product, file } = options;
  const found = new Set([productModuleIdOf({ file, product })]);
  const queue = [resolve(file)];
  const visited = new Set(queue);

  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const id of importers.get(current) ?? []) {
      found.add(id);

      const next = resolve(fileOfModuleId(id));

      if (visited.has(next)) continue;

      visited.add(next);
      queue.push(next);
    }
  }

  return [...found];
};

const isDesignChange = (options: { target: string; config: DesignConfig; system: SystemModules; file: string }) => {
  const { target, config, system, file } = options;
  const designRoot = resolve(target, DESIGN_DIR);
  const styles = Object.values(config.products ?? {}).flatMap((entry) =>
    (entry.styles ?? []).map((style) => resolve(target, style)),
  );
  const baseDirs = system.products().flatMap((name) => system.productOf(name)?.base?.dir ?? []);

  return (
    (isInside(designRoot, file) && !isInside(resolve(designRoot, 'calls'), file)) ||
    styles.includes(file) ||
    baseDirs.some((dir) => isInside(dir, file))
  );
};

/**
 * The parts of each product, as the product itself draws them, that a push touches: the part whose folder
 * holds a changed file, every part that imports a changed file directly or not, every part a changed
 * `styles` or tokens stylesheet feeds, and every part of a product a deleted part or shared file was in.
 */
export const touchedPartsOf = (options: {
  target: string;
  config: DesignConfig;
  changes: PrepushChange[];
}): Map<string, Set<string>> => {
  const { target, config, changes } = options;
  const system = createSystemModules({ target, config });
  const files = changes
    .map((change) => ({ ...change, file: resolve(target, change.file) }))
    .filter(({ file }) => isDesignChange({ target, config, system, file }));
  const touched = new Map<string, Set<string>>();

  if (files.length === 0) return touched;

  const products = system.products();
  const importers = new Map(products.map((product) => [product, importersOf(system, product)]));
  const designRoot = resolve(target, DESIGN_DIR);
  const baseDirs = [...new Set(products.flatMap((name) => system.productOf(name)?.base?.dir ?? []))].filter(
    (dir) => !isInside(designRoot, dir),
  );
  const touch = (drawn: DrawnPart) => {
    if (drawn.sketch) return;

    touched.set(drawn.product, (touched.get(drawn.product) ?? new Set()).add(drawn.part));
  };
  const touchAll = (product: string) =>
    system.drawnOf(product)?.parts.forEach((part) => touch({ product, part: partKeyOf(part), sketch: null }));

  for (const { status, file } of files) {
    for (const product of products) {
      const resolved = system.productOf(product);
      const owner = resolved ? partOfFile(resolved, file) : null;

      if (owner && resolved?.parts.some((part) => partKeyOf(part) === owner))
        touch({ product, part: owner, sketch: null });
    }

    const change =
      status === 'D'
        ? addedPartsOf({ designRoot, baseDirs, system, file })
        : changedPartsOf({
            target,
            config,
            system,
            file,
            dependents: products.flatMap((product) =>
              dependentsOf({ importers: importers.get(product) ?? new Map(), product, file }),
            ),
          });

    if (change.all) products.forEach(touchAll);
    else change.parts.forEach(touch);
  }

  return touched;
};
