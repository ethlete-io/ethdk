import { existsSync, readFileSync } from 'fs';
import { dirname, relative, resolve, sep } from 'path';
import { readConfig } from './design-config';
import { isLintedFile, lintFindingsOf } from './design-lint';
import { ruleProblemsOf } from './system/check-system';
import { isLayer, Layer } from './system/layers';
import { Problem } from './system/problem';
import { productDirOf } from './system/product';
import { partKeyOf, partOfFile, PRODUCT_PART_KEY, resolveProduct, ResolvedProduct } from './system/resolve-product';
import { ruleBaselineOf } from './system/rule-baseline';
import { openSketchProblemsOf } from './system/sketch/check-sketches';
import { listSketches, Sketch, variantDirOf } from './system/sketch/sketch';
import { pageAnchoredDialogsOf, themeClassesOf } from './system/rules/live-rules';

export const LINT_USAGE = 'lint <file>…';

const isInside = (dir: string, file: string) => {
  const path = relative(dir, file);

  return path === '' || (!path.startsWith('..') && !path.startsWith(sep) && !/^[a-zA-Z]:/u.test(path));
};

/** The `<root>/<layer>/<name>` folder `file` sits in, and its layer, for a root laid out like a product. */
const partDirOf = (root: string, file: string): { dir: string; layer: Layer } | null => {
  const [layer, name] = relative(root, file).split(sep);

  return layer && name && isLayer(layer) && isInside(root, file) ? { dir: resolve(root, layer, name), layer } : null;
};

type Scope = { problems: Problem[]; dir: string | null; layer: Layer | null };

const sketchScopeOf = (options: { product: ResolvedProduct; sketch: Sketch; file: string }): Scope => {
  const { product, sketch, file } = options;
  const variants = sketch.variants.filter((variant) => isInside(variantDirOf(sketch, variant), file));
  const listed = openSketchProblemsOf(product, { target: sketch.target }).variants.filter(
    (entry) => entry.sketch.dir === sketch.dir && (variants.length === 0 || variants.includes(entry.variant)),
  );
  const part = variants[0] ? partDirOf(variantDirOf(sketch, variants[0]), file) : null;

  return {
    problems: listed.flatMap((entry) => entry.problems),
    dir: part?.dir ?? null,
    layer: part?.layer ?? sketch.layer,
  };
};

const partScopeOf = (product: ResolvedProduct, file: string): Scope | null => {
  const key = partOfFile(product, file);
  const part = product.parts.find((candidate) => partKeyOf(candidate) === key);

  if (key === PRODUCT_PART_KEY || !part || part.origin === 'base') return null;

  const found = ruleProblemsOf(product, [key]);

  return {
    problems: ruleBaselineOf({ product, problems: found, checked: () => false }).problems,
    dir: dirname(part.file),
    layer: part.layer,
  };
};

const productProblemsOf = (product: ResolvedProduct, file: string): Problem[] => {
  const sketch = listSketches({ productDir: product.dir, product: product.name }).find(
    (candidate): candidate is Sketch => typeof candidate !== 'string' && isInside(candidate.dir, file),
  );
  const scope = sketch ? sketchScopeOf({ product, sketch, file }) : partScopeOf(product, file);

  if (!scope) return [];

  const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const partKeys = product.parts.map(partKeyOf);
  const live = [
    ...themeClassesOf({ file, source, layer: scope.layer }),
    ...pageAnchoredDialogsOf({ file, source, layer: scope.layer, partKeys }),
  ];
  const inScope = (problem: Problem) =>
    problem.file === file || (scope.dir !== null && isInside(scope.dir, problem.file));

  return [...scope.problems.filter(inScope), ...live];
};

const designProblemsOf = (target: string, file: string): Problem[] =>
  Object.entries(readConfig(target)?.products ?? {}).flatMap(([name, config]) =>
    isInside(productDirOf({ target, product: name }), file)
      ? productProblemsOf(resolveProduct({ target, name, config }), file)
      : [],
  );

const uniqueLines = (lines: string[]) => [...new Set(lines)];

/**
 * The findings on design files as an agent writes them: the static design rules of each file's part or sketch variant,
 * and eslint on it. No draw, no type check. Prints one line per finding, each saying what to change, and nothing when
 * the files are clean.
 */
export const designLint = (options: { target: string; argv: string[]; invocation: string; cwd?: string }) => {
  const { target, argv, invocation } = options;
  const files = argv.map((file) => resolve(options.cwd ?? process.cwd(), file));

  if (files.length === 0 || argv.some((argument) => argument.startsWith('-'))) {
    console.error(`usage: ${invocation} ${LINT_USAGE}`);

    return 2;
  }

  const at = (file: string) => relative(target, file);
  const rules = files.flatMap((file) =>
    designProblemsOf(target, file).map((problem) => `${problem.rule} ${at(problem.file)}: ${problem.message}`),
  );
  const eslint = lintFindingsOf({ target, files: files.filter((file) => isLintedFile(file) && existsSync(file)) });

  if (typeof eslint === 'string') console.error(eslint);

  const linted = Array.isArray(eslint)
    ? eslint.map(({ rule, file, line, column, message }) => `${rule} ${at(file)}:${line}:${column}: ${message}`)
    : [];
  const lines = uniqueLines([...rules, ...linted]);

  lines.forEach((line) => console.log(line));

  return lines.length === 0 ? 0 : 1;
};
