import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { hasBadWidths } from '../sketch/part-definition';

/** A part whose `widths` are not a non-empty list of positive numbers. */
export const badWidthsOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => hasBadWidths(part.source))
    .map((part) => ({
      rule: 'WIDTHS',
      file: part.file,
      message: 'widths must be a non-empty list of positive numbers, for example widths: [280, 480, 720]',
    }));
