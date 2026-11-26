import { importsKit, KIT_SPECIFIER } from '../kit';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** A component or foundation that imports the wireframe kit, which only elements and pages may use. */
export const kitOutsidePagesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => (part.layer === 'components' || part.layer === 'foundations') && importsKit(part.source))
    .map((part) => ({
      rule: 'WIREFRAME-KIT',
      file: part.file,
      message: `${part.layer} may not use ${KIT_SPECIFIER} - only elements and pages draw with the wireframe kit`,
    }));
