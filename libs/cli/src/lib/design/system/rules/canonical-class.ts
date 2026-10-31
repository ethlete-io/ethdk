import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { ClassFacts, classFactsOf, partClassesOf, tailwindFailureOf } from './tailwind-classes';

/**
 * A Tailwind class in the markup of a part that has a canonical form under the product's stylesheets, as
 * Tailwind IntelliSense reports it: `w-[420px]` that can be written as `w-2xl`. The root font size the
 * stylesheets set on `html` is the rem base.
 */
export const canonicalClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const classes = partClassesOf(product);

  if (!classes) return [];

  let facts: Map<string, ClassFacts>;

  try {
    facts = classFactsOf({ product, classes });
  } catch (error) {
    return [
      {
        rule: 'CANONICAL-CLASS',
        file: classes.stylesheets[0] ?? product.dir,
        message: `no Tailwind design system - ${tailwindFailureOf(error)}`,
      },
    ];
  }

  return classes.files.flatMap(({ file, candidates }) =>
    candidates.flatMap((candidate) => {
      const canonical = facts.get(candidate)?.canonical;

      return canonical && canonical !== candidate
        ? [{ rule: 'CANONICAL-CLASS', file, message: `The class \`${candidate}\` can be written as \`${canonical}\`` }]
        : [];
    }),
  );
};
