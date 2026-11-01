import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { addedPartsOf, changedPartsOf, DrawnPart } from './changed-parts';
import { DESIGN_DIR, DesignConfig, readConfig } from './paths';
import { PrepushChange } from './prepush-changes';
import { ruleProblemsOf, partOfFile } from './system/check-system';
import { Problem } from './system/problem';
import { partKeyOf, resolveProduct, ResolvedProduct } from './system/resolve-product';
import { createSystemModules, fileOfModuleId, productModuleIdOf, SystemModules } from './system/system-modules';
import { importsOf } from './system/ts-source';

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

const isInBasePart = (product: ResolvedProduct, file: string) =>
  product.parts.some((part) => part.origin === 'base' && isInside(dirname(part.file), file));

/**
 * The static `design check` rules (no browser, no tsc) over the parts a push touches, for the pre-push hook.
 * Prints nothing and passes when no change reaches a design part; fails on any rule problem in a touched part.
 */
export const prepushDesignCheck = (options: { target: string; changes: PrepushChange[] }) => {
  const { target, changes } = options;
  const config = readConfig(target);
  const touched = config ? touchedPartsOf({ target, config, changes }) : new Map<string, Set<string>>();
  const lines: string[] = [];
  const changed = new Set(changes.map(({ file }) => resolve(target, file)));
  let failed = 0;

  for (const [name, parts] of touched) {
    const entry = config?.products?.[name];

    if (!entry) continue;

    const product = resolveProduct({ target, name, config: entry });
    const isOwn = (problem: Problem) =>
      !isInBasePart(product, problem.file) &&
      (parts.has(partOfFile(product, problem.file)) || changed.has(resolve(problem.file)));
    const problems = ruleProblemsOf(product).filter(isOwn);

    lines.push(`design check ${name}: ${parts.size} touched part${parts.size === 1 ? '' : 's'}`);
    problems.forEach((problem) => lines.push(`${problem.rule} ${relative(target, problem.file)}: ${problem.message}`));
    failed += problems.length;
  }

  if (touched.size > 0) lines.push(failed === 0 ? 'ok' : `${failed} design problem${failed === 1 ? '' : 's'}`);

  return { code: failed === 0 ? 0 : 1, lines };
};
