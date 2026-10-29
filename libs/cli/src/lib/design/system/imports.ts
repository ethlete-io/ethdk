import { existsSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { sourceFileOf } from '../vite-paths';
import { assetFileOf, assetPathOf, ASSETS_PREFIX, cssAssetPathsOf } from './assets';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SYSTEM = '@system/';
export const FIXTURES_SPECIFIER = '@system/fixtures';
export const SHARED_PREFIX = '@shared/';

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

export const partDependenciesOf = (part: ResolvedPart) =>
  importsOfPart(part).flatMap((imported) => (imported.kind === 'part' ? [imported] : []));

const leavesFolder = (part: ResolvedPart, specifier: string) => {
  const folder = dirname(part.file);
  const path = relative(folder, resolve(folder, specifier.split('?')[0] ?? specifier));

  return path.startsWith('..') || isAbsolute(path);
};

const sharedFileExists = (sharedDir: string, path: string) => {
  const file = resolve(sharedDir, path.split('?')[0] ?? path);

  return STYLESHEET.test(file) ? existsSync(file) : sourceFileOf(file) !== null;
};

/**
 * Imports and stylesheet `url(@assets/...)` that name no part, fixture set or asset file, `@shared/` imports outside a sketch variant (`sharedDir` is the
 * sketch's `shared/` folder, `assetsDir` the variant's `assets/`), and relative imports that reach into another part.
 */
export const importProblemsOf = (product: ResolvedProduct & { sharedDir?: string; assetsDir?: string }): Problem[] => {
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
      if (imported.kind === 'shared' && !product.sharedDir)
        return problem(
          `${imported.specifier} - only a part in a sketch variant may import the sketch's ${SHARED_PREFIX}`,
        );
      if (imported.kind === 'shared' && !sharedFileExists(product.sharedDir ?? '', imported.path))
        return problem(`${imported.specifier} resolves to no file in the sketch's shared/ folder`);
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
