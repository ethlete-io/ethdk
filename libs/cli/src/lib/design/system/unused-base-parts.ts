import { reachableFilesOf, repoRootOf, sdkDesignFileOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { importsOf } from './ts-source';

const drawsReachedModule = (options: { part: ResolvedPart; root: string; reached: Map<string, string> }) =>
  importsOf(options.part.source).some((specifier) => {
    const file = sdkDesignFileOf(options.root, specifier);

    return file !== null && specifier.endsWith(`/${options.part.name}`) && options.reached.has(file);
  });

/**
 * The keys of the base parts that no own part or token part of the product imports, directly or
 * through other parts, and whose same-named `@ethlete/<lib>/design` module none of them reaches either.
 */
export const unusedBasePartsOf = (product: ResolvedProduct): Set<string> => {
  const base = product.parts.filter((part) => part.origin === 'base');

  if (base.length === 0) return new Set();

  const tokens = new Set(product.tokens);
  const { files, sdkDesign } = reachableFilesOf(
    product,
    product.parts.filter((part) => part.origin !== 'base' || tokens.has(partKeyOf(part))),
  );
  const root = repoRootOf(product);

  return new Set(
    base
      .filter((part) => !files.has(part.file) && !drawsReachedModule({ part, root, reached: sdkDesign }))
      .map(partKeyOf),
  );
};
