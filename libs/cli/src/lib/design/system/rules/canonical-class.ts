import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { appStylesheetOf } from '../harness-config';
import { harnessOf } from '../harness-map';
import { ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';
import {
  appClassesOf,
  ClassFacts,
  classFactsOf,
  NO_STYLES,
  partClassesOf,
  tailwindFailureOf,
} from './tailwind-classes';

/**
 * A Tailwind class in the markup of a part that has a canonical form under the product's stylesheets, as
 * Tailwind IntelliSense reports it: `w-[420px]` that can be written as `w-2xl`. The root font size the
 * stylesheets set on `html` is the rem base.
 */
export const canonicalClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const classes = partClassesOf(product);

  if (!classes) {
    skipRule({ rule: 'CANONICAL-CLASS', product: product.name, kind: 'not-applicable', reason: NO_STYLES });

    return [];
  }

  return canonicalProblemsOf({ holder: product, classes });
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

type Rewrite = { file: string; candidate: string; canonical: string };

const rewritesOf = (options: {
  holder: Parameters<typeof classFactsOf>[0]['product'];
  classes: NonNullable<ReturnType<typeof partClassesOf>>;
}): Rewrite[] | Problem => {
  const { holder, classes } = options;
  let facts: Map<string, ClassFacts>;

  try {
    facts = classFactsOf({ product: holder, classes });
  } catch (error) {
    return {
      rule: 'CANONICAL-CLASS',
      file: classes.stylesheets[0] ?? holder.dir,
      message: `no Tailwind design system - ${tailwindFailureOf(error)}`,
    };
  }

  return classes.files.flatMap(({ file, candidates }) =>
    candidates.flatMap((candidate) => {
      const canonical = facts.get(candidate)?.canonical;

      return canonical && canonical !== candidate ? [{ file, candidate, canonical }] : [];
    }),
  );
};

const canonicalProblemsOf = (options: Parameters<typeof rewritesOf>[0]): Problem[] => {
  const rewrites = rewritesOf(options);

  return Array.isArray(rewrites)
    ? rewrites.map(({ file, candidate, canonical }) => ({
        rule: 'CANONICAL-CLASS',
        file,
        message: `The class \`${candidate}\` can be written as \`${canonical}\``,
      }))
    : [rewrites];
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Writes each canonical form over the class it replaces, whole tokens only, and returns the number of rewritten classes. */
const applyRewrites = (rewrites: Rewrite[]) => {
  let count = 0;

  for (const file of new Set(rewrites.map((rewrite) => rewrite.file))) {
    let source = readFileSync(file, 'utf8');

    for (const { candidate, canonical } of rewrites.filter((rewrite) => rewrite.file === file)) {
      const token = new RegExp(`(?<![^\\s"'\`<>])${escapeRegExp(candidate)}(?![^\\s"'\`<>])`, 'gu');
      const next = source.replace(token, () => canonical);

      if (next !== source) count++;

      source = next;
    }

    writeFileSync(file, source);
  }

  return count;
};

/** Rewrites every class with a canonical form in the markup of the product's parts. Returns the rewritten count. */
export const fixCanonicalClassesOf = (product: ResolvedProduct & SharedDirs): number => {
  const classes = partClassesOf(product);
  const rewrites = classes ? rewritesOf({ holder: product, classes }) : [];

  return Array.isArray(rewrites) ? applyRewrites(rewrites) : 0;
};

/** Rewrites every class with a canonical form in the harness app source. Returns the rewritten count. */
export const fixAppCanonicalClassesOf = (target: string, product: ResolvedProduct): number => {
  const harness = harnessOf(product);

  if (harness === null || typeof harness === 'string') return 0;

  const stylesheet = appStylesheetOf({ target, app: harness.app });

  if (!stylesheet) return 0;

  const { holder, classes } = appClassesOf({
    target,
    dir: resolve(target, harness.app, 'src'),
    stylesheet: resolve(target, stylesheet),
  });
  const rewrites = rewritesOf({ holder, classes });

  return Array.isArray(rewrites) ? applyRewrites(rewrites) : 0;
};
