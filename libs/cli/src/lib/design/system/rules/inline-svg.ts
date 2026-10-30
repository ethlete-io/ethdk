import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

const ICON_SVG = /<svg\b[^>]*\bviewBox\s*=/u;

const tsFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts'))
        .map((path) => resolve(dir, path))
        .sort()
    : [];

/**
 * An `<svg>` with its own `viewBox` written in the TS of a part outside foundations, or in a TS file below the part's
 * folder. An `<svg>` without a `viewBox` draws in the pixels the code computes, as a flow diagram does, and passes.
 */
export const inlineSvgsOf = (product: ResolvedProduct): Problem[] =>
  [
    ...new Set(
      product.parts.filter((part) => part.layer !== 'foundations').flatMap((part) => tsFilesIn(dirname(part.file))),
    ),
  ]
    .filter((file) => ICON_SVG.test(readFileSync(file, 'utf8')))
    .map((file) => ({
      rule: 'INLINE-SVG',
      file,
      message: 'draws an <svg> icon inline - put it in assets/ and draw it with a helper of a foundations part',
    }));
