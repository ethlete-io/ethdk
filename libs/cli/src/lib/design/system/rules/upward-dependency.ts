import { partDependenciesOf } from '../imports';
import { isLayer, LAYER_USES, mayUse } from '../layers';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** A part that imports a part of a layer its own layer may not use. */
export const upwardDependenciesOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) =>
    partDependenciesOf(part).flatMap((dependency) =>
      isLayer(dependency.layer) && !mayUse({ from: part.layer, to: dependency.layer })
        ? [
            {
              rule: 'UPWARD-DEPENDENCY',
              file: part.file,
              message: `${part.layer} may use ${LAYER_USES[part.layer].join(', ') || 'no other layer'}, not ${dependency.specifier}`,
            },
          ]
        : [],
    ),
  );
