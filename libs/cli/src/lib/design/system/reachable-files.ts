import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import { sourceFileOf } from '../vite-paths';
import { ProductSource } from './base';
import { classifyImport, sharedDirsOf, sharedFileOf, SharedDirs } from './imports';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const SDK_DESIGN_MODULE = /^@ethlete\/([\w-]+)\/design((?:\/[\w-]+)*)$/u;

export const repoRootOf = (source: ProductSource) => resolve(dirname(source.configFile), '../..');

const stylesheetImportsOf = (css: string) => {
  const imports: string[] = [];

  try {
    postcss.parse(css).walkAtRules('import', (rule) => {
      const match = /^(?:url\(\s*)?(?:['"]([^'"]+)['"]|([^'"\s)]+))/u.exec(rule.params.trim());
      const specifier = match?.[1] ?? match?.[2];

      if (specifier) imports.push(specifier);
    });
  } catch {
    return [];
  }

  return imports;
};

const relativeFileOf = (file: string, specifier: string) => {
  const path = resolve(dirname(file), specifier.split('?')[0] ?? specifier);

  return path.endsWith('.css') ? (existsSync(path) ? path : null) : sourceFileOf(path);
};

/** The source file of an `@ethlete/<lib>/design[/<path>]` specifier in the repo at `root`, or `null` for any other specifier. */
export const sdkDesignFileOf = (root: string, specifier: string) => {
  const match = SDK_DESIGN_MODULE.exec(specifier);

  return match ? sourceFileOf(resolve(root, 'libs', match[1] ?? '', `design${match[2] ?? ''}`)) : null;
};

const sdkDesignFilesOf = (root: string, specifiers: string[]) => {
  const files = new Map<string, string>();
  const queue = specifiers.flatMap((specifier) => sdkDesignFileOf(root, specifier) ?? []);

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (files.has(file) || !existsSync(file)) continue;

    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    const imports = file.endsWith('.css') ? stylesheetImportsOf(source) : importsOf(source);

    for (const specifier of imports) {
      const found = specifier.startsWith('.') ? relativeFileOf(file, specifier) : sdkDesignFileOf(root, specifier);

      if (found && !files.has(found)) queue.push(found);
    }
  }

  return files;
};

/**
 * The files the parts in `from` reach through relative, shared and system imports, with their
 * sources, and the `@ethlete/<lib>/design` module files they reach. `from` defaults to every part.
 */
export const reachableFilesOf = (product: ResolvedProduct & SharedDirs, from: ResolvedPart[] = product.parts) => {
  const parts = new Map(product.parts.map((part) => [partKeyOf(part), part]));
  const files = new Map<string, string>();
  const packages = new Set<string>();
  const queue = from.flatMap((part) => [part.file, ...(part.css ? [part.css] : [])]);

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (files.has(file) || !existsSync(file)) continue;

    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    const specifiers = file.endsWith('.css') ? stylesheetImportsOf(source) : importsOf(source);

    for (const specifier of specifiers) {
      const imported = classifyImport(specifier);
      let found: string | null = null;

      if (imported.kind === 'relative') {
        found = relativeFileOf(file, specifier);
      } else if (imported.kind === 'other') {
        packages.add(specifier);
      } else if (imported.kind === 'shared') {
        found = sharedFileOf({ dirs: sharedDirsOf(product), path: imported.path });
      } else if (imported.kind === 'part') {
        const part = parts.get(partKeyOf(imported));

        found = imported.stylesheet ? (part?.css ?? null) : (part?.file ?? null);
      }
      if (found && !files.has(found)) queue.push(found);
    }
  }

  return { files, sdkDesign: sdkDesignFilesOf(repoRootOf(product), [...packages]) };
};
