import { DesignConfig } from '../design-config';
import { appFilesOf } from './app-files';
import { embeddedPartsOf } from './embedded-actions';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { linkedComponentOf } from './slow-checks';
import { PrepushChange, touchedPartsOf } from './touched-parts';

/**
 * The own parts of each of `products` that `changes` touch, sorted: each part whose design files changed (as
 * `touchedPartsOf` reads them), each part whose implementing app component reaches a changed file, and every part that
 * embeds one of those.
 */
export const partsChangedOf = (options: {
  target: string;
  config: DesignConfig;
  products: ResolvedProduct[];
  changes: PrepushChange[];
}): Map<string, string[]> => {
  const { products, changes } = options;
  const touched = touchedPartsOf(options);
  const files = new Set(changes.map(({ file }) => file));

  return new Map(
    products.map((product) => {
      const root = repoRootOf(product);
      const own = product.parts.filter((part) => part.origin !== 'base');
      const appChanged = own.filter((part) => {
        const component = linkedComponentOf(part);

        return component !== null && Object.keys(appFilesOf({ root, component })).some((file) => files.has(file));
      });
      const changed = new Set([...(touched.get(product.name) ?? []), ...appChanged.map(partKeyOf)]);
      const hosts = own.filter((part) =>
        embeddedPartsOf({ product, part }).some((embedded) => changed.has(partKeyOf(embedded))),
      );
      const chosen = new Set([...changed, ...hosts.map(partKeyOf)]);

      return [
        product.name,
        own
          .map(partKeyOf)
          .filter((part) => chosen.has(part))
          .sort(),
      ];
    }),
  );
};
