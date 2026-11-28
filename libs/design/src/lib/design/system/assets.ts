import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import { ProductSource } from './base';
import { importsOf } from './ts-source';

export const ASSETS_PREFIX = '@assets/';
export const ASSETS_FOLDER = 'assets';

type AssetSource = Pick<ProductSource, 'dir'> & { base: Pick<ProductSource, 'dir'> | null; assetsDir?: string };

/** The `@assets/` path of a specifier without its query, or `null` for any other import. */
export const assetPathOf = (specifier: string) =>
  specifier.startsWith(ASSETS_PREFIX) ? (specifier.slice(ASSETS_PREFIX.length).split('?')[0] ?? '') : null;

/** The folders `@assets/` looks in, first match wins: a sketch variant's own, the product's, its base product's. */
export const assetDirsOf = (product: AssetSource) => [
  ...(product.assetsDir ? [product.assetsDir] : []),
  resolve(product.dir, ASSETS_FOLDER),
  ...(product.base ? [resolve(product.base.dir, ASSETS_FOLDER)] : []),
];

export const assetFileOf = (options: { product: AssetSource; path: string }) => {
  for (const dir of assetDirsOf(options.product)) {
    const file = resolve(dir, options.path);

    if (file.startsWith(`${dir}${sep}`) && existsSync(file) && statSync(file).isFile()) return file;
  }

  return null;
};

/** A `url(@assets/<file>)` in a stylesheet; the second group is the file's path, without a query or fragment. */
export const ASSET_URL = /url\(\s*(['"]?)@assets\/([^'")?#]+)[^'")]*\1\s*\)/gu;

export const cssAssetPathsOf = (css: string) => [...css.matchAll(ASSET_URL)].flatMap((match) => match[2] ?? []);

/** The `@assets/` paths a source file imports. */
export const assetImportsOf = (source: string) =>
  importsOf(source).flatMap((specifier) => {
    const path = assetPathOf(specifier);

    return path === null ? [] : [path];
  });

/** Every file in a folder and below it, sorted by path, `[]` when it does not exist. */
export const filesBelow = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .sort()
        .flatMap((name) => {
          const path = resolve(dir, name);

          return statSync(path).isDirectory() ? filesBelow(path) : [path];
        })
    : [];

/**
 * The asset files the files of a part folder use, as the product resolves them, sorted by path: the `@assets/`
 * imports of its source files and the `url(@assets/...)` of its stylesheets.
 */
export const importedAssetsOf = (options: { product: AssetSource; files: string[] }) => {
  const paths = options.files.flatMap((file) =>
    /\.(?:ts|js|mjs)$/u.test(file)
      ? assetImportsOf(readFileSync(file, 'utf8'))
      : file.endsWith('.css')
        ? cssAssetPathsOf(readFileSync(file, 'utf8'))
        : [],
  );

  return [...new Set(paths)].sort().flatMap((path) => {
    const file = assetFileOf({ product: options.product, path });

    return file ? [{ path, file }] : [];
  });
};
