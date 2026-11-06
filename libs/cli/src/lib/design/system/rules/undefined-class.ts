import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';
import {
  ClassFacts,
  classFactsOf,
  NO_STYLES,
  partClassesOf,
  stylesheetClassesOf,
  tailwindFailureOf,
} from './tailwind-classes';

const definedIn = (name: string, source: string) =>
  new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')}(?![\\w-])`, 'u').test(source);

/**
 * A class in the markup of a part that Tailwind parses as a utility but that compiles to no CSS against the
 * product's stylesheets, such as `bg-surface-sunken` once the theme drops `--color-surface-sunken`. A class
 * the product's stylesheets or the file itself give a rule is no utility and passes.
 */
export const undefinedClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const classes = partClassesOf(product);

  if (!classes) {
    skipRule({ rule: 'CLASS-UNDEFINED', product: product.name, kind: 'not-applicable', reason: NO_STYLES });

    return [];
  }

  let facts: Map<string, ClassFacts>;

  try {
    facts = classFactsOf({ product, classes });
  } catch (error) {
    skipRule({
      rule: 'CLASS-UNDEFINED',
      product: product.name,
      kind: 'missing-input',
      reason: `Tailwind did not compile the classes: ${tailwindFailureOf(error)}`,
    });

    return [];
  }

  const own = stylesheetClassesOf(product);

  return classes.files.flatMap(({ file, source, classes: found }) =>
    found
      .filter((candidate) => facts.get(candidate)?.emitsNothing && !own.has(candidate) && !definedIn(candidate, source))
      .map((candidate) => ({
        rule: 'CLASS-UNDEFINED',
        file,
        message: `The class \`${candidate}\` compiles to no CSS against the product's stylesheets - Tailwind generates no utility of that name; use a value the product's theme defines`,
      })),
  );
};
