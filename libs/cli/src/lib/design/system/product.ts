import { existsSync, readdirSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import { CACHE_DIR, DESIGN_DIR } from '../design-config';
import { LAYERS, Layer } from './layers';
import { Problem } from './problem';

export type PartFile = { layer: Layer; name: string; file: string; css?: string };

export const productDirOf = (options: { target: string; product: string }) =>
  resolve(options.target, DESIGN_DIR, options.product);

/** The gitignored cache folder of the product whose folder {@link productDirOf} answered. */
export const productCacheDirOf = (productDir: string) =>
  resolve(productDir, '..', ...DESIGN_DIR.split('/').map(() => '..'), CACHE_DIR, basename(productDir));

const foldersOf = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((name) => statSync(resolve(dir, name)).isDirectory()) : [];

/** Every `<layer>/<name>/<name>.ts` of a product folder, with its `<name>.css` when there is one. */
export const partFilesOf = (dir: string) => {
  const parts: PartFile[] = [];
  const problems: Problem[] = [];

  for (const layer of LAYERS) {
    for (const name of foldersOf(resolve(dir, layer)).sort()) {
      const folder = resolve(dir, layer, name);
      const file = resolve(folder, `${name}.ts`);
      const css = resolve(folder, `${name}.css`);

      if (!existsSync(file)) {
        problems.push({ rule: 'PART', file: folder, message: `holds no ${name}.ts` });
        continue;
      }

      parts.push({ layer, name, file, ...(existsSync(css) ? { css } : {}) });
    }
  }

  return { parts, problems };
};

export const fixturesOf = (dir: string) => {
  const file = resolve(dir, 'fixtures.ts');

  return existsSync(file) ? file : null;
};
