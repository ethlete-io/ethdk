import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { headHoldsPart, isOpenOrPickedEditSketch } from './edit-sketch';
import { isEditSketch } from './merged-parts';
import { Sketch } from './sketch';

/**
 * Whether `sketch` is an undecided edit sketch whose part has a change git does not hold. Such a sketch stays in
 * progress: work not yet committed is never put before the user as a pick.
 */
export const editAwaitsCommit = (product: ResolvedProduct, sketch: Sketch) => {
  if (!isEditSketch(sketch) || !isOpenOrPickedEditSketch(sketch) || sketch.decision) return false;

  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(sketch));

  return resolved !== undefined && resolved.origin !== 'base' && !headHoldsPart(product, resolved);
};
