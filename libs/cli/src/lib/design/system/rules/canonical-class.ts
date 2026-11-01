import { resolve } from 'path';
import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { appStylesheetOf } from '../harness-config';
import { harnessOf } from '../harness-map';
import { ResolvedProduct } from '../resolve-product';
import { appClassesOf, ClassFacts, classFactsOf, partClassesOf, tailwindFailureOf } from './tailwind-classes';

/**
 * A Tailwind class in the markup of a part that has a canonical form under the product's stylesheets, as
 * Tailwind IntelliSense reports it: `w-[420px]` that can be written as `w-2xl`. The root font size the
 * stylesheets set on `html` is the rem base.
 */
export const canonicalClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const classes = partClassesOf(product);

  return classes ? canonicalProblemsOf({ holder: product, classes }) : [];
};

/** Canonical-class problems in the `.html` templates and `.ts` class strings of the product's harness app, under the stylesheet that app builds with. */
export const appCanonicalClassesOf = (target: string, product: ResolvedProduct): Problem[] => {
  const harness = harnessOf(product);

  if (harness === null || typeof harness === 'string') return [];

  const stylesheet = appStylesheetOf({ target, app: harness.app });

  if (!stylesheet) return [];

  const { holder, classes } = appClassesOf({
    target,
    dir: resolve(target, harness.app, 'src'),
    stylesheet: resolve(target, stylesheet),
  });

  return canonicalProblemsOf({ holder, classes });
};

const canonicalProblemsOf = (options: {
  holder: Parameters<typeof classFactsOf>[0]['product'];
  classes: NonNullable<ReturnType<typeof partClassesOf>>;
}): Problem[] => {
  const { holder, classes } = options;
  let facts: Map<string, ClassFacts>;

  try {
    facts = classFactsOf({ product: holder, classes });
  } catch (error) {
    return [
      {
        rule: 'CANONICAL-CLASS',
        file: classes.stylesheets[0] ?? holder.dir,
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
