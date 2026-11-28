import { setImmediate } from 'timers/promises';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system-modules';

type WarmedSystem = Pick<ReturnType<typeof createSystemModules>, 'products' | 'productOf' | 'sketchesOf' | 'partOf'>;

/**
 * Loads every part module a Studio page asks for first: the target parts of each open sketch, as the product and as
 * each variant draws them, then every part of each product. One module at a time, yielding between them, and a module
 * that fails to load is skipped. Resolves with the number of module ids it loaded.
 */
export const warmPartModules = async (options: {
  system: WarmedSystem;
  load: (id: string) => Promise<unknown>;
  signal?: AbortSignal;
}) => {
  const { system, load, signal } = options;
  const warmed = new Set<string>();
  const warm = async (
    product: string,
    { file, sketch }: { file: string | undefined; sketch: SketchVariant | null },
  ) => {
    if (!file || signal?.aborted) return;

    const id = productModuleIdOf({ file, product, sketch });

    if (warmed.has(id)) return;

    warmed.add(id);
    await setImmediate();
    if (!signal?.aborted) await load(id).catch(() => undefined);
  };

  for (const product of system.products()) {
    for (const sketch of system.sketchesOf(product)) {
      for (const part of sketch.targets) {
        await warm(product, { file: system.partOf({ product, part })?.file, sketch: null });

        for (const variant of sketch.variants) {
          const drawn = { target: sketch.target, variant };

          await warm(product, { file: system.partOf({ product, part, sketch: drawn })?.file, sketch: drawn });
        }
      }
    }
  }

  for (const product of system.products()) {
    for (const part of system.productOf(product)?.parts ?? []) await warm(product, { file: part.file, sketch: null });
  }

  return warmed.size;
};
