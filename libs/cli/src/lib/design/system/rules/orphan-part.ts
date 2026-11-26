import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { sourceFileOf } from '../../vite-paths';
import { classifyImport, SharedDirs, sharedDirsOf, sharedFileOf } from '../imports';
import { isLibraryProduct } from '../library-product';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';
import { importsOf } from '../ts-source';

export const ORPHAN_PART_RULE = 'ORPHAN-PART';

const ROOT_LAYERS = new Set(['foundations', 'pages']);
const STYLESHEET = /\.css(?:\?.*)?$/u;

type Product = ResolvedProduct & SharedDirs;

const importedPartsOf = (product: Product, part: ResolvedPart) => {
  const dirs = sharedDirsOf(product);
  const seen = new Set<string>([part.file]);
  const queue = [part.file];
  const parts = new Set<string>();

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const imported = classifyImport(specifier);
      const path = specifier.split('?')[0] ?? specifier;

      if (imported.kind === 'part') {
        parts.add(partKeyOf(imported));
        continue;
      }

      const found =
        imported.kind === 'shared'
          ? sharedFileOf({ dirs, path: imported.path })
          : imported.kind === 'relative' && !STYLESHEET.test(path)
            ? sourceFileOf(resolve(dirname(file), path))
            : null;

      if (!found || !existsSync(found) || STYLESHEET.test(found) || seen.has(found)) continue;

      seen.add(found);
      queue.push(found);
    }
  }

  parts.delete(partKeyOf(part));

  return parts;
};

/**
 * Each own component or element part that no other part imports, directly or through one of its files, and that
 * has no `implements` link (`ORPHAN-PART`). Pages are where use starts and foundations are drawn under every frame,
 * so neither is judged; a library product's parts are made for other products, so it is not judged at all.
 */
export const orphanPartsOf = (product: Product): Problem[] => {
  if (isLibraryProduct(product)) return [];

  const used = new Set(product.parts.flatMap((part) => [...importedPartsOf(product, part)]));

  return product.parts
    .filter((part) => part.origin === 'product' && !ROOT_LAYERS.has(part.layer))
    .filter((part) => !used.has(partKeyOf(part)) && partLinkOf(part.source).kind === 'none')
    .map((part) => ({
      rule: ORPHAN_PART_RULE,
      file: part.file,
      part: partKeyOf(part),
      message: `${partKeyOf(part)} is used by no page, no other part and no implements link - embed it where it belongs or delete it`,
    }));
};
