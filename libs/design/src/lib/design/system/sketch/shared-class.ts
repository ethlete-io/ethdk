import { existsSync, readdirSync, readFileSync } from 'fs';
import { relative, resolve } from 'path';
import { classesOf, cssBlocksOf } from '../css-source';
import { partKeyOf } from '../resolve-product';
import { stylesheetsOf } from './duplicate-class';
import { SketchedProduct } from './overlay';

const withoutParens = (selector: string) => {
  let depth = 0;
  let kept = '';

  for (const char of selector) {
    if (char === '(') depth++;
    if (depth === 0) kept += char;
    if (char === ')') depth = Math.max(0, depth - 1);
  }

  return kept;
};

const subjectClassesOf = (selector: string) =>
  selector.split(',').flatMap((part) =>
    classesOf(
      withoutParens(part)
        .trim()
        .split(/\s*[\s>+~]\s*/u)
        .pop() ?? '',
    ),
  );

const sharedCssOf = (sharedDir: string) =>
  existsSync(sharedDir)
    ? (readdirSync(sharedDir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.css'))
        .map((path) => resolve(sharedDir, path))
        .map((file) => ({
          file,
          classes: new Set(cssBlocksOf(readFileSync(file, 'utf8')).selectors.flatMap(classesOf)),
        }))
    : [];

/**
 * A warning for each selector in a stylesheet of a variant whose subject is a class the sketch's `shared/` stylesheets
 * define: the variant restyles shared code, and that coupling stays hidden after a merge.
 */
export const sharedClassWarningsOf = (options: { target: string; product: SketchedProduct }): string[] => {
  const { target, product } = options;
  const shared = [...sharedCssOf(product.variantSharedDir), ...sharedCssOf(product.sharedDir)];

  if (shared.length === 0) return [];

  return product.parts
    .filter((part) => product.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const stylesheets = stylesheetsOf({ product, part });

      return stylesheets
        .filter((file) => !shared.some((entry) => entry.file === file))
        .flatMap((file) =>
          cssBlocksOf(readFileSync(file, 'utf8')).selectors.flatMap((selector) =>
            subjectClassesOf(selector).flatMap((name) => {
              const owner = shared.find((entry) => entry.classes.has(name));
              const reportedAsDuplicate =
                owner && stylesheets.includes(owner.file) && /^\.[\w-]+$/u.test(selector.trim());

              return owner && !reportedAsDuplicate
                ? [
                    `WARNING ${partKeyOf(part)}: ${relative(target, file)} restyles .${name} of ${relative(target, owner.file)} - change it in shared/ or give the variant a class of its own`,
                  ]
                : [];
            }),
          ),
        );
    });
};
