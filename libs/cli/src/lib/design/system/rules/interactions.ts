import { INTERACTIONS } from '../../force-interactions';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { interactionNamesOf } from '../sketch/part-definition';

const isKnown = (name: string) => INTERACTIONS.some((known) => known === name);

/** A part whose `interactions` name one Studio does not know. */
export const unknownInteractionsOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) =>
    interactionNamesOf(part.source)
      .filter((name) => !isKnown(name))
      .map((name) => ({
        rule: 'INTERACTIONS',
        file: part.file,
        message: `unknown interaction "${name}" - interactions are ${INTERACTIONS.join(', ')}; rest is always drawn, and pressed or loading is a state`,
      })),
  );
