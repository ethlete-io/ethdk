import { createHash } from 'crypto';
import { buildReadyInputsOf } from './check-system';
import { PartOpenPoints } from './open-points';
import { BuildReadyInputs } from './part-build-ready';
import { readOpenPoints } from './read-open-points';
import { ResolvedProduct } from './resolve-product';
import { inputsUnchanged, PrintedInput, trackedRun } from './tracked-reads';

type Entry = { product: string; inputs: PrintedInput[]; points: PartOpenPoints[]; ready: BuildReadyInputs };

const entries = new Map<string, Entry>();

const productPrintOf = (product: ResolvedProduct) =>
  createHash('sha1').update(JSON.stringify(product)).digest('base64url');

/**
 * The open points of every part of `product` and its build-ready inputs without a draw, reused while the product
 * resolves the same and every file and folder listing the computing run read still reads the same.
 */
export const cachedOpenPointsOf = (
  product: ResolvedProduct,
): { points: PartOpenPoints[]; inputs: BuildReadyInputs } => {
  const print = productPrintOf(product);
  const held = entries.get(product.dir);

  if (held && held.product === print && inputsUnchanged(held.inputs))
    return { points: held.points, inputs: held.ready };

  const { value, inputs } = trackedRun(() => {
    const points = readOpenPoints(product);

    return { points, ready: buildReadyInputsOf(product, points) };
  });

  entries.set(product.dir, { product: print, inputs, ...value });

  return { points: value.points, inputs: value.ready };
};
