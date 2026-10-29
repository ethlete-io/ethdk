import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { DesignConfig } from '../paths';
import { fsUrl, sourceFileOf } from '../vite-paths';
import { ASSET_URL, assetFileOf, ASSETS_PREFIX } from './assets';
import { classifyImport, sharedFileOf as sharedFileIn } from './imports';
import { partKeyOf, resolveProduct, ResolvedProduct } from './resolve-product';
import { overlaySketch } from './sketch/overlay';
import { findSketch, listSketches, parseTarget, sharedDirOf, Sketch, variantSharedDirOf } from './sketch/sketch';

const PRODUCT_QUERY = 'design-product';
const SKETCH_QUERY = 'design-sketch';
const VARIANT_QUERY = 'design-variant';
const STYLESHEET_FILE = /\.css$/u;

/** One variant of the sketch on `target` (`<layer>/<name>`). */
export type SketchVariant = { target: string; variant: string };

/**
 * The module id of a file as one product draws it, or as one variant of a sketch draws it. A base
 * part is one file but a different module in each product, because each product resolves its
 * `@system/...` imports to its own parts.
 */
export const productModuleIdOf = (options: { file: string; product: string; sketch?: SketchVariant | null }) =>
  `${options.file}?${PRODUCT_QUERY}=${encodeURIComponent(options.product)}` +
  (options.sketch
    ? `&${SKETCH_QUERY}=${encodeURIComponent(options.sketch.target)}&${VARIANT_QUERY}=${encodeURIComponent(options.sketch.variant)}`
    : '');

/** The module id of a stylesheet as one product, or one sketch variant, draws it, its own query (`inline`) kept. */
export const stylesheetModuleIdOf = (options: {
  file: string;
  query: string | undefined;
  product: string;
  sketch: SketchVariant | null;
}) => {
  const { file, query, product, sketch } = options;
  const id = productModuleIdOf({ file, product, sketch });

  return query ? id.replace('?', `?${query}&`) : id;
};

export const productOfModuleId = (id: string | null | undefined) => {
  const query = id?.split('?')[1];

  return query ? new URLSearchParams(query).get(PRODUCT_QUERY) : null;
};

export const sketchOfModuleId = (id: string | null | undefined): SketchVariant | null => {
  const params = new URLSearchParams(id?.split('?')[1] ?? '');
  const target = params.get(SKETCH_QUERY);
  const variant = params.get(VARIANT_QUERY);

  return target && variant ? { target, variant } : null;
};

export const fileOfModuleId = (id: string) => id.split('?')[0] ?? id;

/**
 * The products of a workspace, resolved on first use and kept until `forget`, and the resolution
 * of `@system/<layer>/<name>`, `@system/<layer>/<name>.css?inline` (the part's stylesheet),
 * `@system/fixtures`, a sketch's `@shared/<path>` and `@assets/<file>` (a URL, or the text with `?raw`)
 * inside a module of one product. A relative import of a source file stays in the importer's product
 * and sketch, so a helper file next to a part resolves `@system/...` as the part does.
 */
export const createSystemModules = (options: { target: string; config: DesignConfig; sketchesRoot?: string }) => {
  const { target, config, sketchesRoot } = options;
  const resolved = new Map<string, ResolvedProduct>();
  const sketched = new Map<string, ResolvedProduct | null>();

  const productOf = (name: string) => {
    const entry = config.products?.[name];

    if (!entry) return null;

    const cached = resolved.get(name) ?? resolveProduct({ target, name, config: entry });

    resolved.set(name, cached);

    return cached;
  };

  const sketchesOf = (name: string) => {
    const product = productOf(name);

    return product
      ? listSketches({ productDir: sketchesRoot ?? product.dir, product: name }).filter(
          (sketch): sketch is Sketch => typeof sketch !== 'string',
        )
      : [];
  };

  /** The product as it draws, or as one variant of one of its sketches draws it; `null` when either is missing. */
  const drawnOf = (name: string, sketch?: SketchVariant | null) => {
    const product = productOf(name);

    if (!product || !sketch) return product;

    const key = JSON.stringify([name, sketch.target, sketch.variant]);

    if (sketched.has(key)) return sketched.get(key) ?? null;

    const target = parseTarget(sketch.target);
    const found =
      typeof target === 'string'
        ? null
        : findSketch({ productDir: sketchesRoot ?? product.dir, product: name, sketch: target });
    const drawn =
      found && typeof found !== 'string' && found.variants.includes(sketch.variant)
        ? overlaySketch({ product, sketch: found, variant: sketch.variant })
        : null;

    sketched.set(key, drawn);

    return drawn;
  };

  const partOf = (options: { product: string; part: string; sketch?: SketchVariant | null }) =>
    drawnOf(options.product, options.sketch)?.parts.find((part) => partKeyOf(part) === options.part) ?? null;

  const sharedFileOf = (options: { product: string; sketch: SketchVariant | null; path: string }) => {
    const { product, sketch, path } = options;
    const target = sketch ? parseTarget(sketch.target) : null;
    const productDir = sketchesRoot ?? productOf(product)?.dir;

    if (!target || typeof target === 'string' || !productDir) return null;

    const found = findSketch({ productDir, product, sketch: target });

    return found && typeof found !== 'string' && sketch
      ? sharedFileIn({ dirs: [variantSharedDirOf(found, sketch.variant), sharedDirOf(found)], path })
      : null;
  };

  const resolveId = (specifier: string, importer: string | undefined) => {
    const name = productOfModuleId(importer);
    const imported = classifyImport(specifier);

    if (!name || !importer) return null;

    const sketch = sketchOfModuleId(importer);

    if (imported.kind === 'asset') {
      const drawn = drawnOf(name, sketch);
      const file = drawn ? assetFileOf({ product: drawn, path: imported.path }) : null;

      return file ? `${file}?${specifier.split('?')[1] ?? 'url'}` : null;
    }

    if (imported.kind === 'relative' && STYLESHEET_FILE.test(fileOfModuleId(specifier))) {
      const file = resolve(dirname(fileOfModuleId(importer)), fileOfModuleId(specifier));

      return existsSync(file)
        ? stylesheetModuleIdOf({ file, query: specifier.split('?')[1], product: name, sketch })
        : null;
    }

    if (imported.kind === 'shared' && STYLESHEET_FILE.test(fileOfModuleId(specifier))) {
      const file = sharedFileOf({ product: name, sketch, path: imported.path });

      return file ? stylesheetModuleIdOf({ file, query: specifier.split('?')[1], product: name, sketch }) : null;
    }

    if (imported.kind === 'relative' || imported.kind === 'shared') {
      const file =
        imported.kind === 'shared'
          ? sharedFileOf({ product: name, sketch, path: imported.path })
          : specifier.includes('?')
            ? null
            : sourceFileOf(resolve(dirname(fileOfModuleId(importer)), specifier));

      return file ? productModuleIdOf({ file, product: name, sketch }) : null;
    }

    if (imported.kind !== 'part' && imported.kind !== 'fixtures') return null;

    if (imported.kind === 'part' && imported.stylesheet) {
      const css = partOf({ product: name, part: partKeyOf(imported), sketch })?.css;
      const query = specifier.split('?')[1];

      return css ? stylesheetModuleIdOf({ file: css, query, product: name, sketch }) : null;
    }

    const file =
      imported.kind === 'fixtures'
        ? drawnOf(name, sketch)?.fixtures
        : partOf({ product: name, part: partKeyOf(imported), sketch })?.file;

    return file ? productModuleIdOf({ file, product: name, sketch }) : null;
  };

  /** A product's stylesheet with each `url(@assets/<file>)` turned into the URL of the file the product resolves. */
  const withAssetUrls = (code: string, id: string) => {
    const name = productOfModuleId(id);

    if (!name || !STYLESHEET_FILE.test(fileOfModuleId(id)) || !code.includes(ASSETS_PREFIX)) return null;

    const drawn = drawnOf(name, sketchOfModuleId(id));

    return drawn
      ? code.replace(ASSET_URL, (...[whole = '', , path = '']: string[]) => {
          const file = assetFileOf({ product: drawn, path });

          return file ? `url("${fsUrl(file)}")` : whole;
        })
      : null;
  };

  return {
    products: () => Object.keys(config.products ?? {}),
    productOf,
    sketchesOf,
    drawnOf,
    partOf,
    resolveId,
    withAssetUrls,
    forget: () => {
      resolved.clear();
      sketched.clear();
    },
  };
};

export type SystemModules = ReturnType<typeof createSystemModules>;
