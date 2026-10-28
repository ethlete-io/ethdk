import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { ProductSource } from '../base';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';

const RUNTIME_PREFIX = '--et-';

const stylesTextsOf = (source: ProductSource) => {
  const root = resolve(dirname(source.configFile), '../..');

  return (source.config.styles ?? [])
    .map((style) => resolve(root, style))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'));
};

const definedTokensOf = (product: ResolvedProduct) => {
  const texts = [
    ...product.parts.flatMap((part) => [part.source, part.cssSource ?? '']),
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
  [...new Set(usedTokensOf(part.cssSource ?? ''))]
    .filter((token) => !defined.has(token) && !token.startsWith(RUNTIME_PREFIX))
    .map((token) => ({
      rule: 'UNDEFINED-TOKEN',
      file: part.css ?? part.file,
      message: `var(${token}) has no fallback, and no stylesheet of the product or its base defines ${token}`,
    }));

/**
 * A `var(--token)` without a fallback in the CSS of a part, where neither a part of the product or its
 * base nor a stylesheet its config names defines `--token`. The SDK's runtime `--et-*` tokens are left out.
 */
export const undefinedTokensOf = (product: ResolvedProduct): Problem[] => {
  const defined = definedTokensOf(product);

  return product.parts.flatMap((part) => partProblemsOf(part, defined));
};
