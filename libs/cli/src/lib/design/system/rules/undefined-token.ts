import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import { sourceFileOf } from '../../vite-paths';
import { ProductSource } from '../base';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { classifyImport, sharedDirsOf, sharedFileOf, SharedDirs } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { importsOf } from '../ts-source';

const RUNTIME_PREFIX = '--et-';

const stylesTextsOf = (source: ProductSource) => {
  const root = resolve(dirname(source.configFile), '../..');

  return (source.config.styles ?? [])
    .map((style) => resolve(root, style))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'));
};

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

const reachableFilesOf = (product: ResolvedProduct & SharedDirs) => {
  const parts = new Map(product.parts.map((part) => [partKeyOf(part), part]));
  const files = new Map<string, string>();
  const queue = product.parts.flatMap((part) => [part.file, ...(part.css ? [part.css] : [])]);

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (files.has(file) || !existsSync(file)) continue;

    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    const specifiers = file.endsWith('.css') ? stylesheetImportsOf(source) : importsOf(source);

    for (const specifier of specifiers) {
      const imported = classifyImport(specifier);
      let found: string | null = null;

      if (imported.kind === 'relative') {
        const path = resolve(dirname(file), specifier.split('?')[0] ?? specifier);

        found = path.endsWith('.css') ? (existsSync(path) ? path : null) : sourceFileOf(path);
      } else if (imported.kind === 'shared') {
        found = sharedFileOf({ dirs: sharedDirsOf(product), path: imported.path });
      } else if (imported.kind === 'part') {
        const part = parts.get(partKeyOf(imported));

        found = imported.stylesheet ? (part?.css ?? null) : (part?.file ?? null);
      }
      if (found && !files.has(found)) queue.push(found);
    }
  }

  return files;
};

const folderTextsOf = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => /\.(ts|css)$/u.test(path))
        .map((path) => readFileSync(resolve(dir, path), 'utf8'))
    : [];

const definedTokensOf = (product: ResolvedProduct, files: Map<string, string>) => {
  const texts = [
    ...product.parts.flatMap((part) => [part.source, ...folderTextsOf(dirname(part.file))]),
    ...files.values(),
    ...stylesTextsOf(product),
    ...(product.base ? stylesTextsOf(product.base) : []),
  ];

  return new Set(texts.flatMap((text) => [...text.matchAll(/(--[\w-]+)['"]?\s*:/g)].map((match) => match[1] ?? '')));
};

const usedTokensOf = (css: string) =>
  cssBlocksOf(css).declarations.flatMap((declaration) =>
    [...(declarationValueOf(declaration) ?? '').matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((match) => match[1] ?? ''),
  );

const stylesheetProblemsOf = (options: { file: string; css: string; defined: Set<string> }): Problem[] =>
  [...new Set(usedTokensOf(options.css))]
    .filter((token) => !options.defined.has(token) && !token.startsWith(RUNTIME_PREFIX))
    .map((token) => ({
      rule: 'UNDEFINED-TOKEN',
      file: options.file,
      message: `var(${token}) has no fallback, and no stylesheet of the product or its base defines ${token}`,
    }));

/**
 * Finds undefined tokens in part stylesheets and their reachable relative, shared and system imports.
 * Fallbacks and SDK runtime `--et-*` tokens are permitted.
 */
export const undefinedTokensOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const files = reachableFilesOf(product);
  const defined = definedTokensOf(product, files);

  return [...files].flatMap(([file, source]) =>
    file.endsWith('.css') ? stylesheetProblemsOf({ file, css: source, defined }) : [],
  );
};
