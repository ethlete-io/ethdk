import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { SKIP_CLASSES } from '../skip-classes';
import { textsOf } from '../ts-source';

const SKIP_ATTRIBUTE = /data-et-skip=(?:"([^"]*)"|'([^']*)'|([^\s"'>]*))/gu;

/** A `data-et-skip` in a part that names no reason class, or one the checks do not know. */
export const badSkipsOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) =>
    textsOf(part.source).flatMap((text) =>
      [...text.matchAll(SKIP_ATTRIBUTE)].flatMap((match) => {
        const classes = (match[1] ?? match[2] ?? match[3] ?? '').split(/\s+/u).filter(Boolean);
        const unknown = classes.filter((name) => !SKIP_CLASSES.includes(name));

        if (classes.length === 0)
          return [
            {
              rule: 'SKIP-CLASS',
              file: part.file,
              message: `data-et-skip names no reason class - use one of ${SKIP_CLASSES.join(', ')}`,
            },
          ];

        return unknown.map((name) => ({
          rule: 'SKIP-CLASS',
          file: part.file,
          message: `data-et-skip names "${name}", which is no reason class - use one of ${SKIP_CLASSES.join(', ')}`,
        }));
      }),
    ),
  );
