import { importsKit, KIT_SPECIFIER } from '../kit';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

/** A component, element or foundation that imports the wireframe kit, which only pages may use. */
export const kitOutsidePagesOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.layer !== 'pages' && importsKit(part.source))
    .map((part) => ({
      rule: 'WIREFRAME-KIT',
      file: part.file,
      message: `${part.layer} may not use ${KIT_SPECIFIER} - only pages draw with the wireframe kit`,
    }));
