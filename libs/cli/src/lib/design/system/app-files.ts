import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import ts from 'typescript';
import { sourceFileOf as moduleFileOf } from '../vite-paths';
import { fileHashesOf, FileHashes } from './design-hash';
import { exportedNamesOf, importedNamesOf, sourceFileOf, textsOf } from './ts-source';

type Paths = Record<string, string[]>;

const pathsOf = (root: string): Paths => {
  const file = resolve(root, 'tsconfig.base.json');

  if (!existsSync(file)) return {};

  const parsed = ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8')).config as
    { compilerOptions?: { paths?: Paths } } | undefined;

  return parsed?.compilerOptions?.paths ?? {};
};

const mappedFileOf = (options: { root: string; paths: Paths; specifier: string }) => {
  const { root, paths, specifier } = options;

  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf('*');
    const matched =
      star === -1
        ? pattern === specifier
          ? ''
          : null
        : specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1))
          ? specifier.slice(star, specifier.length - (pattern.length - star - 1))
          : null;

    if (matched === null) continue;

    for (const target of targets) {
      const found = moduleFileOf(resolve(root, target.replace('*', matched)).replace(/\.ts$/u, ''));

      if (found) return found;
    }
  }

  return null;
};

const ownedResourcesOf = (file: string, source: string) =>
  /\b(?:styleUrls?|templateUrl)\s*:/u.test(source)
    ? textsOf(source)
        .filter((text) => /^\.{1,2}\/[^\s'"]+\.(?:css|html)$/u.test(text))
        .map((text) => resolve(dirname(file), text))
    : [];

type ReExport = { specifier: string; names: { exported: string; local: string }[] | null };

const reExportsOf = (source: string): ReExport[] =>
  sourceFileOf(source).statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) return [];
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return [];

    const clause = statement.exportClause;
    const names = !clause
      ? null
      : ts.isNamedExports(clause)
        ? clause.elements.map((element) => ({
            exported: element.name.text,
            local: (element.propertyName ?? element.name).text,
          }))
        : [{ exported: clause.name.text, local: '*' }];

    return [{ specifier: statement.moduleSpecifier.text, names }];
  });

const stampOf = (file: string) => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return -1;
  }
};

const reached = new Map<string, { stamps: [string, number][]; hashes: FileHashes }>();

const reachedFilesOf = (options: { root: string; component: string }) => {
  const { root } = options;
  const paths = pathsOf(root);
  const sources = new Map<string, string>();
  const read = (file: string) => {
    const known = sources.get(file);

    if (known !== undefined) return known;

    const source = existsSync(file) ? readFileSync(file, 'utf8') : '';

    sources.set(file, source);

    return source;
  };
  const targetOf = (from: string, specifier: string) =>
    specifier.startsWith('.')
      ? moduleFileOf(resolve(dirname(from), specifier))
      : mappedFileOf({ root, paths, specifier });

  const declaringFilesOf = (at: { file: string; name: string }, seen: Set<string>): string[] => {
    const { file, name } = at;
    const key = `${file}\0${name}`;

    if (seen.has(key)) return [];

    seen.add(key);

    const source = read(file);
    const reExports = reExportsOf(source);
    const forwarded = new Set(reExports.flatMap(({ names }) => (names ?? []).map(({ exported }) => exported)));

    if (exportedNamesOf(source).some((exported) => exported === name && !forwarded.has(exported))) return [file];

    for (const { specifier, names } of reExports) {
      const target = targetOf(file, specifier);
      const local = names === null ? name : names.find((entry) => entry.exported === name)?.local;

      if (!target || local === undefined) continue;
      if (local === '*') return [target];

      const found = declaringFilesOf({ file: target, name: local }, seen);

      if (found.length > 0) return found;
    }

    return [];
  };
  const filesOfName = (file: string, name: string) => {
    const found = declaringFilesOf({ file, name }, new Set());

    return found.length > 0 || sourceFileOf(read(file)).statements.every(ts.isExportDeclaration) ? found : [file];
  };

  const files = new Set<string>();
  const queue = [resolve(root, options.component)];

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (files.has(file) || !existsSync(file)) continue;

    files.add(file);

    if (!file.endsWith('.ts')) continue;

    const source = read(file);

    queue.push(...ownedResourcesOf(file, source));

    for (const [specifier, names] of importedNamesOf(source)) {
      const target = targetOf(file, specifier);

      if (!target) continue;
      if (names.has('*')) {
        queue.push(target);
        continue;
      }

      for (const name of names) queue.push(...filesOfName(target, name));
    }
  }

  return [...files];
};

/**
 * The files of a repository an Angular component reaches: relative imports, `templateUrl` and `styleUrl` files, and
 * for an import through a `tsconfig.base.json` path (an `@ethlete/<lib>` entry point) or a barrel, only the files that
 * declare the imported names, not the whole barrel. Each reached file adds its own imports the same way.
 */
export const appFilesOf = (options: { root: string; component: string }): FileHashes => {
  const key = `${options.root}\0${options.component}`;
  const known = reached.get(key);

  if (known && known.stamps.every(([file, stamp]) => stampOf(file) === stamp)) return known.hashes;

  const files = reachedFilesOf(options);
  const hashes = fileHashesOf(options.root, files);

  reached.set(key, { stamps: files.map((file) => [file, stampOf(file)]), hashes });

  return hashes;
};
