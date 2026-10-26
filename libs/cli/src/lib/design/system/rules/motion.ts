import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { calledNamesOf } from '../ts-source';

const TIMED = ['requestAnimationFrame', 'setInterval'];

/** A part that drives motion from script frames, which a timeline cannot stop at a given time. */
export const scriptedMotionOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) =>
    [...new Set(calledNamesOf(part.source).filter((name) => TIMED.includes(name)))].map((name) => ({
      rule: 'MOTION',
      file: part.file,
      message: `calls ${name} - motion must be CSS animation, CSS transition or the Web Animations API`,
    })),
  );
