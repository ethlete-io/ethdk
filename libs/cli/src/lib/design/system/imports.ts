import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { sourceFileOf } from '../vite-paths';
import { ProductSource } from './base';
import { assetFileOf, assetPathOf, ASSETS_PREFIX, cssAssetPathsOf } from './assets';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SYSTEM = '@system/';
export const FIXTURES_SPECIFIER = '@system/fixtures';
export const SHARED_PREFIX = '@shared/';

/** The folder of helper code that is no part: a product's own, a sketch's, or a sketch variant's, imported as `@shared/<path>`. */
export const SHARED_FOLDER = 'shared';

export type PartImport =
  | { kind: 'part'; layer: string; name: string; specifier: string; stylesheet?: true }
  | { kind: 'fixtures'; specifier: string }
  | { kind: 'shared'; path: string; specifier: string }
  | { kind: 'asset'; path: string; specifier: string }
  | { kind: 'relative'; specifier: string }
  | { kind: 'other'; specifier: string };

const STYLESHEET = /\.css(?:\?.*)?$/u;

export const partSpecifierOf = (part: { layer: string; name: string }) => `${SYSTEM}${partKeyOf(part)}`;

export const classifyImport = (specifier: string): PartImport => {
  if (specifier === FIXTURES_SPECIFIER) return { kind: 'fixtures', specifier };

  if (specifier.startsWith(SYSTEM)) {
    const [layer = '', ...path] = specifier.slice(SYSTEM.length).split('/');
    const name = path.join('/');
    const stylesheet = STYLESHEET.exec(name);

    return stylesheet
      ? { kind: 'part', layer, name: name.slice(0, stylesheet.index), specifier, stylesheet: true }
      : { kind: 'part', layer, name, specifier };
  }

  const asset = assetPathOf(specifier);

  if (asset !== null) return { kind: 'asset', path: asset, specifier };
  if (specifier.startsWith(SHARED_PREFIX))
    return { kind: 'shared', path: specifier.slice(SHARED_PREFIX.length), specifier };
  if (specifier.startsWith('.')) return { kind: 'relative', specifier };

  return { kind: 'other', specifier };
};

export const importsOfPart = (part: ResolvedPart) => importsOf(part.source).map(classifyImport);

/** The modules of the part's own folder its file imports, directly or through another such module. */
export const folderModulesOf = (part: ResolvedPart) => {
  const folder = dirname(part.file);
  const seen = new Set<string>([part.file]);
  const queue = [{ file: part.file, source: part.source }];
  const modules: { file: string; source: string }[] = [];

  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const specifier of importsOf(current.source)) {
      if (!specifier.startsWith('.') || STYLESHEET.test(specifier)) continue;

      const file = sourceFileOf(resolve(dirname(current.file), specifier.split('?')[0] ?? specifier));
      const path = file === null ? '..' : relative(folder, file);

      if (file === null || seen.has(file) || path.startsWith('..') || isAbsolute(path)) continue;

      seen.add(file);

      const module = { file, source: readFileSync(file, 'utf8') };

      modules.push(module);
      queue.push(module);
    }
  }

  return modules;
};

/** The parts a part imports, from its file or from a plain module of its own folder that the file imports. */
export const partDependenciesOf = (part: ResolvedPart) => {
  const seen = new Set<string>();

  return [part, ...folderModulesOf(part)]
    .flatMap((module) => importsOf(module.source).map(classifyImport))
    .flatMap((imported) => {
      if (imported.kind !== 'part' || seen.has(imported.specifier)) return [];

      seen.add(imported.specifier);

      return [imported];
    });
};

const leavesFolder = (part: ResolvedPart, specifier: string) => {
  const folder = dirname(part.file);
  const path = relative(folder, resolve(folder, specifier.split('?')[0] ?? specifier));

  return path.startsWith('..') || isAbsolute(path);
};

export type SharedDirs = { sharedDir?: string; variantSharedDir?: string };

type SharedSource = Pick<ProductSource, 'dir'> & { base: Pick<ProductSource, 'dir'> | null };

/** The `shared/` folders of a product and of its base, in that order. */
export const productSharedDirsOf = (product: SharedSource) => [
  resolve(product.dir, SHARED_FOLDER),
  ...(product.base ? [resolve(product.base.dir, SHARED_FOLDER)] : []),
];

/** The folders `@shared/<path>` looks in, first match wins: the variant's own `shared/`, the sketch's, the product's, its base's. */
export const sharedDirsOf = (product: SharedDirs & SharedSource) => [
  ...[product.variantSharedDir, product.sharedDir].filter((dir): dir is string => dir !== undefined),
  ...productSharedDirsOf(product),
];

/** The file `@shared/<path>` resolves to, the variant's own copy first; `null` when no folder holds it. */
export const sharedFileOf = (options: { dirs: string[]; path: string }) => {
  const path = options.path.split('?')[0] ?? options.path;

  for (const dir of options.dirs) {
    const file = resolve(dir, path);
    const found = STYLESHEET.test(file) ? (existsSync(file) ? file : null) : sourceFileOf(file);

    if (found) return found;
  }

  return null;
};

const SOURCE_FILE = /\.(?:ts|js|mjs)$/u;

/**
 * The files of the product's and its base's `shared/` folders that `files` import as `@shared/<path>`, and the
 * files those reach in turn, each with its path inside its `shared/` folder, sorted by that path.
 */
export const importedSharedOf = (options: { product: SharedSource; files: string[] }) => {
  const dirs = productSharedDirsOf(options.product);
  const reached = new Map<string, string>();
  const queue = options.files.filter((file) => SOURCE_FILE.test(file));

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const imported = classifyImport(specifier);
      const path = specifier.split('?')[0] ?? specifier;
      const found =
        imported.kind === 'shared'
          ? sharedFileOf({ dirs, path: imported.path })
          : imported.kind === 'relative' && reached.has(file)
            ? sharedFileOf({ dirs: [dirname(file)], path })
            : null;
      const dir = found ? dirs.find((candidate) => found.startsWith(`${candidate}${sep}`)) : undefined;

      if (!found || !dir || reached.has(found)) continue;

      reached.set(found, relative(dir, found).split(sep).join('/'));

      if (SOURCE_FILE.test(found)) queue.push(found);
    }
  }

  return [...reached].map(([file, path]) => ({ path, file })).sort((a, b) => a.path.localeCompare(b.path));
};

/**
 * Imports and stylesheet `url(@assets/...)` that name no part, fixture set, asset file or `shared/` file (`sharedDir` is the
 * sketch's `shared/` folder, `assetsDir` the variant's `assets/`), and relative imports that reach into another part.
 */
export const importProblemsOf = (product: ResolvedProduct & SharedDirs & { assetsDir?: string }): Problem[] => {
  const parts = new Map(product.parts.map((part) => [partKeyOf(part), part]));

  const missingCssAssets = (part: ResolvedPart): Problem[] =>
    cssAssetPathsOf(part.cssSource ?? '')
      .filter((path) => !assetFileOf({ product, path }))
      .map((path) => ({
        rule: 'IMPORT',
        file: part.css ?? part.file,
        message: `url(${ASSETS_PREFIX}${path}) resolves to no file in an assets/ folder`,
      }));

  return product.parts.flatMap((part) => [
    ...missingCssAssets(part),
    ...importsOfPart(part).flatMap((imported): Problem[] => {
      const problem = (message: string) => [{ rule: 'IMPORT', file: part.file, message }];

      if (imported.kind === 'part' && !parts.has(partKeyOf(imported)))
        return problem(`${imported.specifier} resolves to no part`);
      if (imported.kind === 'part' && imported.stylesheet && !parts.get(partKeyOf(imported))?.css)
        return problem(`${imported.specifier} resolves to a part without ${imported.name}.css`);
      if (imported.kind === 'fixtures' && !product.fixtures)
        return problem(`${FIXTURES_SPECIFIER} resolves to no fixtures.ts`);
      if (imported.kind === 'shared' && !sharedFileOf({ dirs: sharedDirsOf(product), path: imported.path }))
        return problem(
          product.sharedDir
            ? `${imported.specifier} resolves to no file in the variant's, the sketch's or the product's shared/ folder`
            : `${imported.specifier} resolves to no file in the product's shared/ folder`,
        );
      if (imported.kind === 'asset' && !assetFileOf({ product, path: imported.path }))
        return problem(`${imported.specifier} resolves to no file in an assets/ folder`);
      if (imported.kind === 'relative' && leavesFolder(part, imported.specifier))
        return problem(
          `"${imported.specifier}" leaves the part's folder - import another part as @system/<layer>/<name>`,
        );

      return [];
    }),
  ]);
};

/** The parts `from` imports, directly or through another part, as the product resolves them. */
export const partsReachedFrom = (options: { product: ResolvedProduct; from: ResolvedPart }): ResolvedPart[] => {
  const parts = new Map(options.product.parts.map((part) => [partKeyOf(part), part]));
  const reached = new Map<string, ResolvedPart>();
  const queue = [options.from];

  for (let part = queue.shift(); part !== undefined; part = queue.shift()) {
    for (const dependency of partDependenciesOf(part)) {
      const key = partKeyOf(dependency);
      const found = parts.get(key);

      if (!found || reached.has(key)) continue;

      reached.set(key, found);
      queue.push(found);
    }
  }

  return [...reached.values()];
};
