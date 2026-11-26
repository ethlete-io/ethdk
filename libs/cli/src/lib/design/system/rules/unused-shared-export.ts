import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { SHARED_FOLDER } from '../sketch/sketch';
import { exportedNamesOf, importedNamesOf } from '../ts-source';

const tsFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts'))
        .map((path) => resolve(dir, path))
        .sort()
    : [];

const candidatesOf = (path: string) => [path, `${path}.ts`, resolve(path, 'index.ts')];

/**
 * Each export of a `shared/` file that no file of `importers` imports, named or through the whole module.
 * `resolveSpecifier` turns a specifier of an importing file into a path, or `null` for one that cannot reach `shared/`;
 * `scope` names the importers in the message, as in "nothing in variant a imports it".
 */
export const unusedExportsOf = (options: {
  sharedDir: string;
  importers: string[];
  resolveSpecifier: (options: { file: string; specifier: string }) => string | null;
  scope?: string;
}): Problem[] => {
  const { sharedDir, importers, resolveSpecifier, scope } = options;
  const shared = tsFilesIn(sharedDir);

  if (shared.length === 0) return [];

  const taken = new Map<string, Set<string>>();

  for (const file of new Set([...importers, ...shared]))
    for (const [specifier, names] of importedNamesOf(readFileSync(file, 'utf8'))) {
      const path = resolveSpecifier({ file, specifier: specifier.split('?')[0] ?? specifier });
      const target = path === null ? undefined : candidatesOf(path).find((candidate) => shared.includes(candidate));

      if (!target) continue;

      const known = taken.get(target) ?? new Set<string>();

      names.forEach((name) => known.add(name));
      taken.set(target, known);
    }

  return shared.flatMap((file) => {
    const used = taken.get(file) ?? new Set<string>();

    return used.has('*')
      ? []
      : exportedNamesOf(readFileSync(file, 'utf8'))
          .filter((name) => !used.has(name))
          .map((name) => ({
            rule: 'UNUSED-EXPORT',
            file,
            message: `${name} is exported, but nothing ${scope ? `${scope} ` : ''}imports it - delete it or drop the export`,
          }));
  });
};

const relativeOf = ({ file, specifier }: { file: string; specifier: string }) =>
  specifier.startsWith('.') ? resolve(dirname(file), specifier) : null;

/** Each export of a file in a part's own `shared/` folder that no file of the part imports. */
export const unusedSharedExportsOf = (product: ResolvedProduct): Problem[] =>
  [...new Set(product.parts.map((part) => dirname(part.file)))].flatMap((folder) =>
    unusedExportsOf({
      sharedDir: resolve(folder, SHARED_FOLDER),
      importers: tsFilesIn(folder),
      resolveSpecifier: relativeOf,
    }),
  );
