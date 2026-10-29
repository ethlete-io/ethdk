import { existsSync, readFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { classesOf, cssBlocksOf } from '../css-source';
import { classifyImport, SHARED_PREFIX } from '../imports';
import { partKeyOf, ResolvedPart } from '../resolve-product';
import { importsOf } from '../ts-source';
import { SketchedProduct } from './overlay';

const bareClassesOf = (css: string) =>
  cssBlocksOf(css).selectors.flatMap((selector) =>
    selector
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^\.[\w-]+$/u.test(part))
      .flatMap(classesOf),
  );

const stylesheetsOf = (options: { product: SketchedProduct; part: ResolvedPart }) => {
  const { product, part } = options;
  const files = new Set<string>(part.css ? [part.css] : []);

  for (const specifier of importsOf(part.source)) {
    const imported = classifyImport(specifier);
    const path = specifier.split('?')[0] ?? specifier;

    if (!path.endsWith('.css')) continue;

    if (imported.kind === 'relative') files.add(resolve(dirname(part.file), path));
    else if (imported.kind === 'shared') files.add(resolve(product.sharedDir, path.slice(SHARED_PREFIX.length)));
    else if (imported.kind === 'part' && imported.stylesheet) {
      const owner = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(imported));

      if (owner?.css) files.add(owner.css);
    }
  }

  return [...files].filter((file) => existsSync(file));
};

/**
 * A warning for each class that two stylesheets loaded by one part of a variant both define as a
 * selector of its own: the later one silently changes the earlier.
 */
export const duplicateClassWarningsOf = (options: { target: string; product: SketchedProduct }): string[] => {
  const { target, product } = options;

  return product.parts
    .filter((part) => product.sketched.includes(partKeyOf(part)))
    .flatMap((part) => {
      const owners = new Map<string, string[]>();

      for (const file of stylesheetsOf({ product, part }))
        for (const name of new Set(bareClassesOf(readFileSync(file, 'utf8'))))
          owners.set(name, [...(owners.get(name) ?? []), file]);

      return [...owners]
        .filter(([, files]) => files.length > 1)
        .map(
          ([name, files]) =>
            `WARNING ${partKeyOf(part)}: .${name} is defined in ${files.map((file) => relative(target, file)).join(' and ')} - rename one`,
        );
    });
};
