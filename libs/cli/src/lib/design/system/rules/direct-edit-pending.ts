import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { changedOutsideSketchOf } from '../sketch/merged-parts';

export const DIRECT_EDIT_PENDING = 'DIRECT-EDIT-PENDING';

/** Each merged part whose files moved since its `merged.json` hash while no open sketch holds it. */
export const directEditPendingOf = (product: ResolvedProduct): Problem[] =>
  changedOutsideSketchOf(product).flatMap((key) => {
    const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

    return part
      ? [
          {
            rule: DIRECT_EDIT_PENDING,
            file: part.file,
            at: 'merged-hash',
            message: `${key} changed since its merged hash and no sketch holds it - run \`et design check --product ${product.name} --part ${key}\` to open the edit sketch or auto-accept it`,
          },
        ]
      : [];
  });
