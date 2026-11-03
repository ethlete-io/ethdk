import { readFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { sourceFileOf } from '../../vite-paths';
import { classifyImport, SHARED_FOLDER, SharedDirs, sharedDirsOf, sharedFileOf } from '../imports';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { importsOf } from '../ts-source';
import { InlineUi, inlineUiOf } from './inline-ui';
import { OPEN_INLINE_UI, OpenInlineUi } from './inline-ui-in-page-open';

const RULE = 'INLINE-UI-IN-PAGE';
const STYLESHEET = /\.css(?:\?.*)?$/u;

type Product = ResolvedProduct & SharedDirs;

type Hit = InlineUi & { file: string; place: string };

const below = (dir: string | undefined, file: string) => {
  if (dir === undefined) return null;

  const path = relative(dir, file);

  return path === '' || path.startsWith('..') || isAbsolute(path) ? null : path.split(sep).join('/');
};

/** Where a file of a page lands in the product: a sketch's `shared/` file goes into the page's own `shared/` on merge. */
const placeOf = (options: { product: Product; part: ResolvedPart; file: string }) => {
  const { product, part, file } = options;
  const key = partKeyOf(part);
  const own = below(dirname(part.file), file);

  if (own !== null) return `${key}/${own}`;

  const shared = below(product.variantSharedDir, file) ?? below(product.sharedDir, file);

  if (shared !== null) return `${key}/${SHARED_FOLDER}/${shared}`;

  const variantDir = product.variantSharedDir ? dirname(product.variantSharedDir) : undefined;

  return below(variantDir, file) ?? below(product.dir, file) ?? file;
};

const modulesOf = (product: Product, part: ResolvedPart) => {
  const dirs = sharedDirsOf(product);
  const seen = new Set<string>([part.file]);
  const queue = [part.file];

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
      const imported = classifyImport(specifier);
      const path = specifier.split('?')[0] ?? specifier;
      const found =
        imported.kind === 'shared'
          ? sharedFileOf({ dirs, path: imported.path })
          : imported.kind === 'relative' && !STYLESHEET.test(path)
            ? sourceFileOf(resolve(dirname(file), path))
            : null;

      if (!found || STYLESHEET.test(found) || seen.has(found)) continue;

      seen.add(found);
      queue.push(found);
    }
  }

  return [...seen];
};

const hitsOf = (product: Product): Hit[] => {
  const places = new Map<string, string>();
  const taken = new Set<string>();

  for (const part of product.parts.filter((entry) => entry.layer === 'pages' && entry.origin !== 'base'))
    for (const file of modulesOf(product, part)) {
      const place = placeOf({ product, part, file });

      if (taken.has(place) || places.has(file)) continue;

      taken.add(place);
      places.set(file, place);
    }

  return [...places].flatMap(([file, place]) =>
    inlineUiOf(readFileSync(file, 'utf8')).map((hit) => ({ ...hit, file, place })),
  );
};

const groupKeyOf = (entry: { place: string; anchor: string; kind: string }) =>
  `${entry.place}#${entry.anchor}#${entry.kind}`;

const messageOf = (hit: Hit) => {
  const name = hit.part.slice(hit.part.indexOf('/') + 1);
  const where = `line ${hit.line}: ${hit.kind} in ${hit.anchor}`;

  return hit.kind.startsWith('<et-') || hit.kind.startsWith('[et-') || hit.part === 'components/button'
    ? `${where} is raw SDK markup - embed ${hit.part} instead (import ${kebabToCamel(name)} from '@system/${hit.part}' and await ${kebabToCamel(name)}.render({...}))`
    : `${where} is inline UI - move it into components/${name} or elements/${name} and embed it`;
};

const kebabToCamel = (name: string) => name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/** Splits the inline UI of a product's pages into errors (unlisted, or beyond or below what an open entry allows) and warnings (listed). */
export const inlineUiVerdictOf = (options: {
  product: Product;
  open: OpenInlineUi[];
}): { errors: Problem[]; warnings: Problem[] } => {
  const { product } = options;
  const open = options.open.filter((entry) => entry.product === product.name);
  const groups = new Map<string, Hit[]>();

  for (const hit of hitsOf(product)) groups.set(groupKeyOf(hit), [...(groups.get(groupKeyOf(hit)) ?? []), hit]);

  const errors: Problem[] = [];
  const warnings: Problem[] = [];

  for (const [key, hits] of groups) {
    const entry = open.find((candidate) => groupKeyOf(candidate) === key);

    if (!entry) {
      errors.push(...hits.map((hit) => ({ rule: RULE, file: hit.file, message: messageOf(hit) })));
    } else if (hits.length > entry.count) {
      errors.push(
        ...hits.map((hit) => ({
          rule: RULE,
          file: hit.file,
          message: `${messageOf(hit)} - ${hit.anchor} holds ${hits.length} ${hit.kind} but OPEN_INLINE_UI allows ${entry.count} (${entry.owner})`,
        })),
      );
    } else {
      warnings.push(
        ...hits.map((hit) => ({ rule: RULE, file: hit.file, message: `${messageOf(hit)} (open, ${entry.owner})` })),
      );
    }
  }

  const isSketch = product.sharedDir !== undefined;

  for (const entry of isSketch ? [] : open) {
    const found = groups.get(groupKeyOf(entry))?.length ?? 0;

    if (found < entry.count)
      errors.push({
        rule: RULE,
        file: resolve(product.dir, entry.place),
        message: `OPEN_INLINE_UI allows ${entry.count} ${entry.kind} in ${entry.anchor} (${entry.owner}) but ${found} remain - lower or remove the entry, the list only shrinks`,
      });
  }

  return { errors, warnings };
};

/** Interactive UI a page writes as markup instead of embedding an element or component part (`INLINE-UI-IN-PAGE`). */
export const inlineUiInPageProblemsOf = (product: Product): Problem[] =>
  inlineUiVerdictOf({ product, open: OPEN_INLINE_UI }).errors;

/** One warning per inline UI hit the open list still allows. */
export const inlineUiInPageWarningsOf = (product: Product): Problem[] =>
  inlineUiVerdictOf({ product, open: OPEN_INLINE_UI }).warnings;
