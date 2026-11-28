import { DesignConfig } from '../design-config';
import { declaredPartActionsOf } from './action-lost';
import { partActionFailuresOf } from './actions-command';
import { embeddedPartsOf } from './embedded-actions';
import { BuildReadyData, buildReadyDataInWorker } from './open-points-runner';
import { ActionsOf, DeclaredActionsOf, recordBuildReady } from './part-build-ready';
import { partPointsOf } from './read-open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { PRODUCT_PART } from './slow-checks';

export type RecordSettledRequest = {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  settled: string[];
};

/** The parts a settled slow run decides: the settled parts and every part that embeds one, or all parts for the product. */
export const recordedPartsOf = ({ product, settled }: { product: ResolvedProduct; settled: string[] }) => {
  const own = product.parts.filter((part) => part.origin !== 'base');

  if (settled.includes(PRODUCT_PART)) return own.map(partKeyOf);

  const changed = new Set(settled);

  return own
    .filter(
      (part) =>
        changed.has(partKeyOf(part)) ||
        embeddedPartsOf({ product, part }).some((embedded) => changed.has(partKeyOf(embedded))),
    )
    .map(partKeyOf);
};

/**
 * Writes or drops the check record of each part a settled slow run decides; the open points and rule problems come from
 * the open-points worker.
 */
export const recordSettledBuildReady = async (
  request: RecordSettledRequest & {
    dataOf?: (product: ResolvedProduct) => Promise<BuildReadyData>;
    actionsOf?: ActionsOf;
    declaredActionsOf?: DeclaredActionsOf;
  },
) => {
  const { target, config, product } = request;
  const { points, problems } = await (request.dataOf ?? buildReadyDataInWorker)(product);

  await recordBuildReady({
    product,
    by: 'et design serve',
    cmd: 'serve',
    parts: recordedPartsOf(request),
    inputs: { pointsOf: (part) => partPointsOf(points, part), problemsOf: (part) => problems[part] ?? [] },
    actionsOf: request.actionsOf ?? ((part) => partActionFailuresOf({ target, config, product, part })),
    declaredActionsOf:
      request.declaredActionsOf ?? ((part) => declaredPartActionsOf({ target, config, product, part })),
  });
};
