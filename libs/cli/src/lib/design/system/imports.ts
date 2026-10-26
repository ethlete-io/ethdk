import { dirname, isAbsolute, relative, resolve } from 'path';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SYSTEM = '@system/';
export const FIXTURES_SPECIFIER = '@system/fixtures';

export type PartImport =
  | { kind: 'part'; layer: string; name: string; specifier: string }
  | { kind: 'fixtures'; specifier: string }
  | { kind: 'relative'; specifier: string }
  | { kind: 'other'; specifier: string };

export const partSpecifierOf = (part: { layer: string; name: string }) => `${SYSTEM}${partKeyOf(part)}`;

export const classifyImport = (specifier: string): PartImport => {
  if (specifier === FIXTURES_SPECIFIER) return { kind: 'fixtures', specifier };

  if (specifier.startsWith(SYSTEM)) {
    const [layer = '', ...name] = specifier.slice(SYSTEM.length).split('/');

    return { kind: 'part', layer, name: name.join('/'), specifier };
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
  const keys = new Set(product.parts.map(partKeyOf));

  return product.parts.flatMap((part) =>
    importsOfPart(part).flatMap((imported): Problem[] => {
      const problem = (message: string) => [{ rule: 'IMPORT', file: part.file, message }];

      if (imported.kind === 'part' && !keys.has(partKeyOf(imported)))
        return problem(`${imported.specifier} resolves to no part`);
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
