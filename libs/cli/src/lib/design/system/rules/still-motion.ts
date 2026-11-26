import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { motionRefsOf, stateNamesOf } from '../sketch/part-definition';

const MOTION_STATES = ['motion', 'animation'];

const MOVES = /\banimation(-name)?\s*:|\btransition(-property)?\s*:|@keyframes\b|\.animate\s*\(/u;

const movesIn = (text: string | null) => text !== null && MOVES.test(text);

/** An own part with a `motion` state whose source and styles declare no animation, transition or motion. */
export const stillMotionStatesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.origin !== 'base')
    .flatMap((part): Problem[] => {
      const states = (stateNamesOf(part.source) ?? []).filter((state) => MOTION_STATES.includes(state));

      if (states.length === 0) return [];
      if (motionRefsOf(part.source).motions.length > 0 || movesIn(part.source) || movesIn(part.cssSource)) return [];

      return [
        {
          rule: 'MOTION-STILL',
          file: part.file,
          states,
          message: `state ${states.join(', ')} shows motion, but the part declares no animation, transition or motions - animate it`,
        },
      ];
    });
