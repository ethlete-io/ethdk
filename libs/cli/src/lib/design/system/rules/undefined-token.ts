import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { ProductSource } from '../base';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { classifyImport } from '../imports';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { importsOf } from '../ts-source';

const RUNTIME_PREFIX = '--et-';

const stylesTextsOf = (source: ProductSource) => {
  const root = resolve(dirname(source.configFile), '../..');

  return (source.config.styles ?? [])
    .map((style) => resolve(root, style))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'));
};

const stylesheetsOf = (part: ResolvedPart) => {
  const imported = importsOf(part.source)
    .filter((specifier) => classifyImport(specifier).kind === 'relative')
    .map((specifier) => specifier.split('?')[0] ?? specifier)
    .filter((path) => path.endsWith('.css'))
    .map((path) => resolve(dirname(part.file), path))
    .filter((file) => file !== part.css && existsSync(file))
    .map((file) => ({ file, css: readFileSync(file, 'utf8') }));

  return [...(part.css && part.cssSource !== null ? [{ file: part.css, css: part.cssSource }] : []), ...imported];
};

const folderTextsOf = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => /\.(ts|css)$/u.test(path))
        .map((path) => readFileSync(resolve(dir, path), 'utf8'))
    : [];

const definedTokensOf = (product: ResolvedProduct) => {
  const texts = [
    ...product.parts.flatMap((part) => [
      part.source,
      ...stylesheetsOf(part).map(({ css }) => css),
      ...folderTextsOf(dirname(part.file)),
    ]),
    ...stylesTextsOf(product),
    ...(product.base ? stylesTextsOf(product.base) : []),
  ];

  return new Set(texts.flatMap((text) => [...text.matchAll(/(--[\w-]+)['"]?\s*:/g)].map((match) => match[1] ?? '')));
};

const usedTokensOf = (css: string) =>
  cssBlocksOf(css).declarations.flatMap((declaration) =>
    [...(declarationValueOf(declaration) ?? '').matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((match) => match[1] ?? ''),
  );

const partProblemsOf = (part: ResolvedPart, defined: Set<string>): Problem[] =>
  stylesheetsOf(part).flatMap(({ file, css }) =>
    [...new Set(usedTokensOf(css))]
      .filter((token) => !defined.has(token) && !token.startsWith(RUNTIME_PREFIX))
      .map((token) => ({
        rule: 'UNDEFINED-TOKEN',
        file,
        message: `var(${token}) has no fallback, and no stylesheet of the product or its base defines ${token}`,
      })),
  );

/**
 * A `var(--token)` without a fallback in a stylesheet of a part (its own and the ones it imports relatively), where neither a part of the product or its
 * base nor a stylesheet its config names defines `--token`. The SDK's runtime `--et-*` tokens are left out.
 */
export const undefinedTokensOf = (product: ResolvedProduct): Problem[] => {
  const defined = definedTokensOf(product);

  return product.parts.flatMap((part) => partProblemsOf(part, defined));
};
