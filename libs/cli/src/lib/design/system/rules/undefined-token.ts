import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { ProductSource } from '../base';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { reachableFilesOf, repoRootOf } from '../reachable-files';
import { ResolvedProduct } from '../resolve-product';

const RUNTIME_PREFIX = '--et-';

const stylesTextsOf = (source: ProductSource) => {
  const root = repoRootOf(source);

  return (source.config.styles ?? [])
    .map((style) => resolve(root, style))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'));
};

const folderTextsOf = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => /\.(ts|css)$/u.test(path))
        .map((path) => readFileSync(resolve(dir, path), 'utf8'))
    : [];

const definedTokensOf = (product: ResolvedProduct, sources: string[]) => {
  const texts = [
    ...product.parts.flatMap((part) => [part.source, ...folderTextsOf(dirname(part.file))]),
    ...sources,
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
 * Fallbacks, SDK runtime `--et-*` tokens and the tokens of imported `@ethlete/<lib>/design` modules are permitted.
 */
export const undefinedTokensOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const { files, sdkDesign } = reachableFilesOf(product);
  const defined = definedTokensOf(product, [...files.values(), ...sdkDesign.values()]);

  return [...files].flatMap(([file, source]) =>
    file.endsWith('.css') ? stylesheetProblemsOf({ file, css: source, defined }) : [],
  );
};
