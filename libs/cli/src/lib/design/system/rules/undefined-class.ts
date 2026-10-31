import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { ClassFacts, classFactsOf, partClassesOf, stylesheetClassesOf } from './tailwind-classes';

const definedIn = (name: string, source: string) =>
  new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')}(?![\\w-])`, 'u').test(source);

/**
 * A class in the markup of a part that Tailwind parses as a utility but that compiles to no CSS against the
 * product's stylesheets, such as `bg-surface-sunken` once the theme drops `--color-surface-sunken`. A class
 * the product's stylesheets or the file itself give a rule is no utility and passes.
 */
export const undefinedClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const classes = partClassesOf(product);

  if (!classes) return [];

  let facts: Map<string, ClassFacts>;

  try {
    facts = classFactsOf({ product, classes });
  } catch {
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
