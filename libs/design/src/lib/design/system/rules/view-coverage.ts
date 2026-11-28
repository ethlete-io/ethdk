import { existsSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';

const VIEW_FILE = /-view\.component\.ts$/u;

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesUnder(path);

    return entry.isFile() ? [path] : [];
  });

const linkedComponentOf = (source: string) => {
  const link = partLinkOf(source);

  if (link.kind === 'component') return link.path;
  if (link.kind === 'route') return link.component;

  return null;
};

/**
 * The views of a product's harness app (`*-view.component.ts` under `<harness.app>/src`) that no part names in its
 * `implements`, as paths from the repository root. A product without a harness app has no views.
 */
export const uncoveredViewsOf = (product: ResolvedProduct): string[] => {
  const app = product.config.harness?.app;

  if (!app) return [];

  const checkout = resolve(product.configFile, '../../..');
  const src = resolve(checkout, app, 'src');

  if (!existsSync(src)) return [];

  const covered = new Set(product.parts.map((part) => linkedComponentOf(part.source)));

  return filesUnder(src)
    .filter((file) => VIEW_FILE.test(file))
    .map((file) => relative(checkout, file))
    .filter((view) => !covered.has(view))
    .sort();
};

/** The line `design check` prints under the open points of a product, or nothing when every view has a part. */
export const uncoveredViewsText = (product: string, views: string[]): string[] =>
  views.length === 0
    ? []
    : [
        `OPEN POINTS ${product} views: ${views.length} without a part that implements ${views.length === 1 ? 'it' : 'them'}`,
        ...views.map((view) => `  ${view}`),
      ];
