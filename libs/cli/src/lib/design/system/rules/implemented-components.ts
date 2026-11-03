import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { ResolvedProduct } from '../resolve-product';
import { partLinkOf } from '../sketch/part-definition';

export type AppInput = { name: string; initializer: string };

export type ImplementedComponent = { file: string; selector: string | null; inputs: AppInput[] };

export const appSourcesOf = (dir: string): { path: string; text: string }[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : appSourcesOf(path);

    return /\.(ts|html)$/u.test(entry.name) && !entry.name.endsWith('.spec.ts')
      ? [{ path, text: readFileSync(path, 'utf8') }]
      : [];
  });

const INPUT_PATTERN = /\bpublic\s+(\w+)\s*=\s*input(?:\.required)?\s*(?:<[^(]*>)?\s*\(([^\n]*)\)\s*;/gu;

export const inputsOf = (source: string): AppInput[] =>
  [...source.matchAll(INPUT_PATTERN)].map((match) => ({ name: match[1] as string, initializer: match[2] as string }));

export const selectorOf = (source: string) => source.match(/\bselector\s*:\s*['"`]([^'"`]+)['"`]/u)?.[1] ?? null;

const componentPathsOf = (product: ResolvedProduct) =>
  new Set(
    product.parts.flatMap((part) => {
      const link = partLinkOf(part.source);

      return link.kind === 'component' ? [link.path] : link.kind === 'route' && link.component ? [link.component] : [];
    }),
  );

/** The `*.component.ts` files the parts of `product` implement, with their selector and `input()` fields, grouped by the `src` folder of the app. */
export const implementedComponentsOf = (
  product: ResolvedProduct,
): { checkout: string; appDir: string; components: ImplementedComponent[] }[] => {
  const checkout = resolve(product.configFile, '../../..');
  const byApp = new Map<string, string[]>();

  for (const path of componentPathsOf(product)) {
    const root = path.match(/^(.*?\/src)\//u)?.[1];

    if (root) byApp.set(root, [...(byApp.get(root) ?? []), path]);
  }

  return [...byApp].map(([root, paths]) => ({
    checkout,
    appDir: resolve(checkout, root),
    components: paths.map((path) => {
      const text = existsSync(resolve(checkout, path)) ? readFileSync(resolve(checkout, path), 'utf8') : '';

      return { file: relative(checkout, resolve(checkout, path)), selector: selectorOf(text), inputs: inputsOf(text) };
    }),
  }));
};
