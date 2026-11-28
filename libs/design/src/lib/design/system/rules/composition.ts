import { partDependenciesOf } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { declaresControlsOf, interactionNamesOf } from '../sketch/part-definition';

const embeddedPartCountOf = (part: ResolvedPart) =>
  new Set(
    partDependenciesOf(part)
      .filter((dependency) => dependency.layer !== 'foundations' && !dependency.stylesheet)
      .map(partKeyOf)
      .filter((key) => key !== partKeyOf(part)),
  ).size;

/** Whether a part is composition only: a component or element that embeds at least two other parts and draws no control of its own. */
export const isCompositionPart = (part: ResolvedPart) =>
  part.layer !== 'pages' &&
  part.layer !== 'foundations' &&
  !declaresControlsOf(part.source) &&
  embeddedPartCountOf(part) >= 2;

/** A composition part that still declares `interactions`. */
export const compositionWithInteractionsOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter(isCompositionPart)
    .filter((part) => interactionNamesOf(part.source).length > 0)
    .map((part) => ({
      rule: 'COMPOSITION',
      file: part.file,
      message: `${partKeyOf(part)} declares no controls of its own, so it is composition only (rather a page) and gets no interaction columns - drop its interactions, or declare the controls it draws itself`,
    }));
