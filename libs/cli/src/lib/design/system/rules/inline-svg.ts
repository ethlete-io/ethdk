import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

const SVG_TAG = /<svg\b[^>]*>/gu;
const DRAWING = /\sdata-et-drawing\b/u;

const tsFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts'))
        .map((path) => resolve(dir, path))
        .sort()
    : [];

/**
 * An `<svg>` written in the TS of a part outside foundations, or in a TS file below the part's folder. An `<svg>` that
 * the code computes, for example the edges of a flow diagram, passes with a `data-et-drawing` attribute.
 */
export const inlineSvgsOf = (product: ResolvedProduct): Problem[] =>
  [
    ...new Set(
      product.parts.filter((part) => part.layer !== 'foundations').flatMap((part) => tsFilesIn(dirname(part.file))),
    ),
  ]
    .filter((file) => [...readFileSync(file, 'utf8').matchAll(SVG_TAG)].some(([tag]) => !DRAWING.test(tag)))
    .map((file) => ({
      rule: 'INLINE-SVG',
      file,
      message:
        'draws an <svg> inline - put it in assets/ and draw it with a helper of a foundations part, or mark a computed drawing with data-et-drawing',
    }));
