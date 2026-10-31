import { readFileSync } from 'fs';
import { relative, resolve } from 'path';
import postcss from 'postcss';
import { SharedDirs } from '../imports';
import { Problem } from '../problem';
import { productStylesheetFilesOf } from '../product-stylesheets';
import { ResolvedProduct } from '../resolve-product';
import { partClassesOf } from './tailwind-classes';

type Denial = { test: RegExp; fix: string };

const COLOUR_UTILITIES = ['bg', 'text', 'border', 'ring', 'divide', 'outline', 'fill', 'stroke'];

const denialsOf = (product: ResolvedProduct): { denials: Denial[]; problems: Problem[] } => {
  const denials: Denial[] = [];
  const problems: Problem[] = [];

  for (const { pattern, fix } of product.config.deniedClasses ?? []) {
    try {
      denials.push({ test: new RegExp(pattern, 'u'), fix });
    } catch (error) {
      problems.push({
        rule: 'DENIED-CLASS-CONFIG',
        file: product.configFile,
        message: `deniedClasses of ${product.name}: the pattern \`${pattern}\` is no valid regular expression - ${(error as Error).message}`,
      });
    }
  }

  return { denials, problems };
};

const utilityOf = (candidate: string) => {
  let depth = 0;
  let start = 0;

  for (let index = 0; index < candidate.length; index++) {
    const char = candidate[index];

    if (char === '[' || char === '(') depth++;
    else if (char === ']' || char === ')') depth--;
    else if (char === ':' && depth === 0) start = index + 1;
  }

  return candidate
    .slice(start)
    .replace(/^!|!$/gu, '')
    .replace(/\/(?:\d+|\[[^\]]*\]|\([^)]*\))$/u, '');
};

const varsIn = (text: string) => [...text.matchAll(/var\(\s*(--[\w-]+)/gu)].map(([, name]) => `var(${name})`);

const denialOf = (denials: Denial[], used: string) => denials.find(({ test }) => test.test(used));

const isInFoundations = (product: ResolvedProduct, file: string) =>
  !relative(resolve(product.dir, 'foundations'), file).startsWith('..');

const partProblemsOf = (product: ResolvedProduct & SharedDirs, denials: Denial[]): Problem[] => {
  const files = (partClassesOf(product)?.files ?? []).map(({ file, source, classes }) => ({
    file,
    used: [...classes.map(utilityOf), ...varsIn(source)],
  }));
  const css = product.parts
    .filter((part) => part.origin !== 'base' && part.css && part.cssSource)
    .map((part) => ({ file: part.css as string, used: varsIn(part.cssSource as string) }));

  return [...files, ...css]
    .filter(({ file }) => !isInFoundations(product, file))
    .flatMap(({ file, used }) =>
      [...new Set(used)].flatMap((each) => {
        const denial = denialOf(denials, each);

        return denial
          ? [{ rule: 'DENIED-CLASS', file, message: `\`${each}\` is denied in this product - ${denial.fix}` }]
          : [];
      }),
    );
};

const exposedBy = (property: string) => [
  `var(${property})`,
  ...(property.startsWith('--color-')
    ? COLOUR_UTILITIES.map((utility) => `${utility}-${property.slice('--color-'.length)}`)
    : []),
];

const stylesheetProblemsOf = (product: ResolvedProduct, denials: Denial[]): Problem[] => {
  const problems: Problem[] = [];
  const report = ({ file, defined, exposed }: { file: string; defined: string; exposed: string[] }) => {
    const hit = exposed.map((each) => ({ each, denial: denialOf(denials, each) })).find(({ denial }) => denial);

    if (hit?.denial)
      problems.push({
        rule: 'DENIED-STYLESHEET',
        file,
        message: `${defined} exposes the denied \`${hit.each}\` - the product stylesheet defines only the inputs of the SDK themes; ${hit.denial.fix}`,
      });
  };

  for (const file of productStylesheetFilesOf(product)) {
    if (isInFoundations(product, file)) continue;

    let root: postcss.Root;

    try {
      root = postcss.parse(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }

    root.walkDecls(/^--/u, (decl) => report({ file, defined: `\`${decl.prop}\``, exposed: exposedBy(decl.prop) }));
    root.walkAtRules('utility', (rule) =>
      report({ file, defined: `\`@utility ${rule.params}\``, exposed: [rule.params.trim()] }),
    );
    root.walkRules((rule) => {
      for (const [, name] of rule.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/gu))
        if (name) report({ file, defined: `\`.${name}\``, exposed: [name] });
    });
  }

  return problems;
};

/**
 * A class or `var()` reference in a part outside foundations that a pattern of the product's `deniedClasses`
 * matches, and a definition in the product's own stylesheets that would expose one: a custom property, a
 * `--color-*` theme value, an `@utility` or a class rule.
 */
export const deniedClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const { denials, problems } = denialsOf(product);

  if (denials.length === 0) return problems;

  return [...problems, ...partProblemsOf(product, denials), ...stylesheetProblemsOf(product, denials)];
};
