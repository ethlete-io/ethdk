import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ASSETS_FOLDER, filesBelow } from '../assets';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ROOT_SVG = /<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/u;
const XMLNS = /\sxmlns\s*=\s*(["'])(.*?)\1/u;

const problemOf = (source: string) => {
  const root = ROOT_SVG.exec(source.replace(/<!--[\s\S]*?-->/gu, ''));

  if (!root) return 'has no root <svg> element';

  return XMLNS.exec(root[0])?.[2] === SVG_NAMESPACE
    ? null
    : `the root <svg> has no xmlns="${SVG_NAMESPACE}" - an image viewer or <img src> does not draw it`;
};

/** An SVG in the product's `assets/`, or in a sketch variant's own `assets/` when the product is one, that is not a usable SVG. */
export const badSvgAssetsOf = (product: ResolvedProduct & { assetsDir?: string }): Problem[] =>
  filesBelow(product.assetsDir ?? resolve(product.dir, ASSETS_FOLDER))
    .filter((file) => file.endsWith('.svg'))
    .flatMap((file) => {
      const message = problemOf(readFileSync(file, 'utf8'));

      return message ? [{ rule: 'SVG-ASSET', file, message }] : [];
    });
