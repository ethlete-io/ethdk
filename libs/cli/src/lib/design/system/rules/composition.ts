import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { declaresControlsOf, interactionNamesOf } from '../sketch/part-definition';

/** Whether a part file is composition only: no page, and no control of its own, so every control it shows belongs to an embedded part. */
export const isCompositionSource = (options: { key: string; source: string }) =>
  !options.key.startsWith('pages/') && !declaresControlsOf(options.source);

/** A composition part that still declares `interactions`. */
export const compositionWithInteractionsOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => isCompositionSource({ key: partKeyOf(part), source: part.source }))
    .filter((part) => interactionNamesOf(part.source).length > 0)
    .map((part) => ({
      rule: 'COMPOSITION',
      file: part.file,
      message: `${partKeyOf(part)} declares no controls of its own, so it is composition only (rather a page) and gets no interaction columns - drop its interactions, or declare the controls it draws itself`,
    }));
