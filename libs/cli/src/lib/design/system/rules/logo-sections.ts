import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { SketchedProduct } from '../sketch/overlay';
import { stateNamesOf } from '../sketch/part-definition';

export const LOGO_SECTIONS = ['anatomy', 'clear-space', 'minimum-size', 'colour-variants', 'misuse', 'motion'];

/** A merged `foundations/logo` part that has no state for one of the six logo sections; an unpicked sketch variant is exempt. */
export const logoPartsWithoutSectionsOf = (product: ResolvedProduct): Problem[] =>
  (product as Partial<SketchedProduct>).picked === false
    ? []
    : product.parts
        .filter((part) => partKeyOf(part) === 'foundations/logo')
        .flatMap((part) => {
          const states = stateNamesOf(part.source) ?? [];

          return LOGO_SECTIONS.filter((section) => !states.includes(section)).map((section) => ({
            rule: 'LOGO-SECTION',
            file: part.file,
            message: `a merged logo part needs a "${section}" state (sections: ${LOGO_SECTIONS.join(', ')})`,
          }));
        });
