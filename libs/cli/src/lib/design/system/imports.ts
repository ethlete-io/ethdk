import { dirname, isAbsolute, relative, resolve } from 'path';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SYSTEM = '@system/';
export const FIXTURES_SPECIFIER = '@system/fixtures';

export type PartImport =
  | { kind: 'part'; layer: string; name: string; specifier: string; stylesheet?: true }
  | { kind: 'fixtures'; specifier: string }
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

/** Imports that name no part or fixture set, and relative imports that reach into another part. */
export const importProblemsOf = (product: ResolvedProduct): Problem[] => {
  const parts = new Map(product.parts.map((part) => [partKeyOf(part), part]));

  return product.parts.flatMap((part) =>
    importsOfPart(part).flatMap((imported): Problem[] => {
      const problem = (message: string) => [{ rule: 'IMPORT', file: part.file, message }];

      if (imported.kind === 'part' && !parts.has(partKeyOf(imported)))
        return problem(`${imported.specifier} resolves to no part`);
      if (imported.kind === 'part' && imported.stylesheet && !parts.get(partKeyOf(imported))?.css)
        return problem(`${imported.specifier} resolves to a part without ${imported.name}.css`);
      if (imported.kind === 'fixtures' && !product.fixtures)
        return problem(`${FIXTURES_SPECIFIER} resolves to no fixtures.ts`);
      if (imported.kind === 'relative' && leavesFolder(part, imported.specifier))
        return problem(
          `"${imported.specifier}" leaves the part's folder - import another part as @system/<layer>/<name>`,
        );

      return [];
    }),
  );
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
