import { DesignConfig } from '../../design-config';
import { embedderProblemCodesOf, embeddersOfPart } from '../check-system';
import { partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { Sketch, variantDirOf } from './sketch';

const staleEmbeddersOf = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}) => {
  const { target, config, product, sketch, variant } = options;
  const merged = new Set([...sketch.targets, ...partFilesOf(variantDirOf(sketch, variant)).parts.map(partKeyOf)]);
  const embedders = new Set(
    [...merged].flatMap((part) =>
      embeddersOfPart({ target, config, products: [product.name], part }).map((found) => found.part),
    ),
  );

  return [...embedders].filter((part) => !merged.has(part)).sort();
};

/**
 * Checks the parts that embed what the merge of `variant` changes, before the merge; the answered function, called once
 * the merge landed, prints them and checks them again, with one line per problem code a part did not show before. It
 * never changes the exit code.
 */
export const embedderCheckAroundMerge = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string | undefined;
}): Promise<() => Promise<void>> => {
  const { target, config, product, sketch, variant } = options;
  const parts =
    variant === undefined || sketch.status !== 'ready' || !sketch.variants.includes(variant)
      ? []
      : staleEmbeddersOf({ ...options, variant });

  if (parts.length === 0) return async () => undefined;

  const embedders = parts.map((part) => ({ part, products: [product.name] }));
  const check = () => embedderProblemCodesOf({ target, config, products: [product.name], embedders });
  const before = await check();

  return async () => {
    console.log(
      `STALE EMBEDDERS ${product.name}: ${parts.join(', ')} - they embed a part the merge of ${sketch.target} changed`,
    );

    const after = await check();
    const lines = parts.flatMap((part) => {
      const was = before.get(part);
      const is = after.get(part);

      if (!was || !is) return [`EMBEDDER NOT CHECKED ${part}: it did not draw ${was ? 'after' : 'before'} the merge`];

      const added = is.filter((code) => !was.includes(code));

      return added.length > 0
        ? [
            `NEW PROBLEM ${part}: ${added.join(', ')} - since the merge of ${sketch.target}; design check --part ${part} --product ${product.name} shows it`,
          ]
        : [];
    });

    if (lines.length === 0)
      console.log(`EMBEDDERS NO NEW PROBLEM: ${parts.length} part${parts.length === 1 ? '' : 's'}`);

    lines.forEach((line) => console.log(line));
  };
};
