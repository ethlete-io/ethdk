import { DesignConfig } from '../paths';
import { classifyImport } from './imports';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';

const PRODUCT_QUERY = 'design-product';

/**
 * The module id of a file as one product draws it. A base part is one file but a different module
 * in each product, because each product resolves its `@system/...` imports to its own parts.
 */
export const productModuleIdOf = (options: { file: string; product: string }) =>
  `${options.file}?${PRODUCT_QUERY}=${encodeURIComponent(options.product)}`;

export const productOfModuleId = (id: string | null | undefined) => {
  const query = id?.split('?')[1];

  return query ? new URLSearchParams(query).get(PRODUCT_QUERY) : null;
};

export const fileOfModuleId = (id: string) => id.split('?')[0] ?? id;

/**
 * The products of a workspace, resolved on first use and kept until `forget`, and the resolution
 * of `@system/<layer>/<name>` and `@system/fixtures` inside a module of one product.
 */
export const createSystemModules = (options: { target: string; config: DesignConfig }) => {
  const { target, config } = options;
  const resolved = new Map<string, ResolvedProduct>();

  const productOf = (name: string) => {
    const entry = config.products?.[name];

    if (!entry) return null;

    const cached = resolved.get(name) ?? resolveProduct({ target, name, config: entry });

    resolved.set(name, cached);

    return cached;
  };

  const partOf = (options: { product: string; part: string }) =>
    productOf(options.product)?.parts.find((part) => partKeyOf(part) === options.part) ?? null;

  const resolveId = (specifier: string, importer: string | undefined) => {
    const name = productOfModuleId(importer);
    const imported = classifyImport(specifier);

    if (!name || (imported.kind !== 'part' && imported.kind !== 'fixtures')) return null;

    const file =
      imported.kind === 'fixtures'
        ? productOf(name)?.fixtures
        : partOf({ product: name, part: partKeyOf(imported) })?.file;

    return file ? productModuleIdOf({ file, product: name }) : null;
  };

  return {
    products: () => Object.keys(config.products ?? {}),
    productOf,
    partOf,
    resolveId,
    forget: () => resolved.clear(),
  };
};

export type SystemModules = ReturnType<typeof createSystemModules>;
