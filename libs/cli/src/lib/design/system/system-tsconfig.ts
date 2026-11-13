import { existsSync, mkdirSync, readFileSync } from 'fs';
import { isAbsolute, relative, resolve, sep } from 'path';
import { typecheck, typecheckAsync, TypecheckResult } from '../typecheck';
import { DRAWING_COMPILER_OPTIONS, writeTsconfigText } from '../calls-tsconfig';
import { editorAssetRootOf, installedAssetRoot } from '../package-root';
import { readConfig } from '../design-config';
import { workRootOf } from '../work-root';
import { renderPackagesOf, typePathsOf } from '../render-packages';
import {
  FIXTURES_SPECIFIER,
  partSpecifierOf,
  productSharedDirsOf,
  SHARED_PREFIX,
  SharedDirs,
  sharedDirsOf,
} from './imports';
import { KIT_SPECIFIER } from './kit';
import { productDirOf } from './product';
import { ResolvedProduct, resolveProduct } from './resolve-product';
import { JsonStyle, prettierJsonOf } from './prettier-json';
import { jsonStyleOf } from './sketch/check-format';
import { overlaySketch } from './sketch/overlay';
import { listSketches, sharedDirOf, variantDirOf } from './sketch/sketch';

export const DESIGN_SYSTEM_SPECIFIER = '@design-system';

/**
 * Writes the tsconfig that types one product's design system, and answers with its path. Each
 * `@system/<layer>/<name>` maps to the part the product resolves, so an override also replaces
 * the part inside the base parts that import it.
 */
export const writeSystemTsconfig = (options: { target: string; product: ResolvedProduct & SharedDirs }) => {
  const { target, product } = options;
  const work = workRootOf(target);
  const path = resolve(work, `system-${product.name}.tsconfig.json`);

  mkdirSync(work, { recursive: true });
  writeTsconfigText(path, jsonTextOf(systemTsconfigOf({ target, product })));

  return path;
};

const productTypecheckOf = (options: { target: string; product: ResolvedProduct & SharedDirs }) => {
  const tsconfig = writeSystemTsconfig(options);

  return { target: options.target, tsconfig, buildInfo: `${tsconfig}.tsbuildinfo` };
};

/** The one typecheck of a product, shared by `design check` and every sketch variant. */
export const typecheckProduct = (options: { target: string; product: ResolvedProduct & SharedDirs }): TypecheckResult =>
  typecheck(productTypecheckOf(options));

/** `typecheckProduct` that does not block the event loop. */
export const typecheckProductAsync = (options: { target: string; product: ResolvedProduct & SharedDirs }) =>
  typecheckAsync(productTypecheckOf(options));

/**
 * Writes `tsconfig.json` into the product's own folder, the nearest tsconfig an editor finds for
 * its parts, so `@design-system` and `@system/*` resolve there, and one into each sketch variant with the
 * paths of its sketch typecheck; the sketch folder's own one types its `shared/` like the first variant. The
 * files are gitignored. A folder outside the checkout or inside a `node_modules` gets none, and a run from a
 * temporary build keeps the files it finds.
 */
export const writeEditorTsconfig = (options: { target: string; product: ResolvedProduct }) => {
  const { target, product } = options;
  const inside = relative(target, product.dir);

  if (!existsSync(product.dir) || inside.startsWith('..') || isAbsolute(inside)) return;
  if (inside.split(sep).includes('node_modules')) return;

  const assetRoot = editorAssetRootOf(target);

  if (!assetRoot) return;

  writeTsconfigText(
    resolve(product.dir, 'tsconfig.json'),
    jsonTextOf(systemTsconfigOf({ target, product, assetRoot })),
  );

  const style = jsonStyleOf({ target, dir: product.dir });

  for (const sketch of listSketches({ productDir: product.dir, product: product.name })) {
    if (typeof sketch === 'string') continue;

    const variants = sketch.variants.map((variant) => ({
      dir: variantDirOf(sketch, variant),
      product: overlaySketch({ product, sketch, variant }),
    }));
    const shared = {
      dir: sharedDirOf(sketch),
      product: variants[0]?.product ?? { ...product, sharedDir: sharedDirOf(sketch) },
    };

    writeSketchEditorTsconfig({ target, assetRoot, style, file: resolve(sketch.dir, 'tsconfig.json'), ...shared });

    for (const variant of variants)
      writeSketchEditorTsconfig({ target, assetRoot, style, file: resolve(variant.dir, 'tsconfig.json'), ...variant });
  }
};

const writeSketchEditorTsconfig = (options: {
  target: string;
  assetRoot: string;
  style: JsonStyle | null;
  file: string;
  dir: string;
  product: ResolvedProduct & SharedDirs;
}) => {
  const config = systemTsconfigOf({
    target: options.target,
    product: options.product,
    assetRoot: options.assetRoot,
    include: [options.dir],
  });

  writeTsconfigText(options.file, options.style ? prettierJsonOf(config, options.style) : jsonTextOf(config));
};

/**
 * Rewrites every editor tsconfig of `target` whose `@design-system` file is gone, e.g. after a run from a
 * temporary build that has since been deleted.
 */
export const repairEditorTsconfigs = (target: string) => {
  const config = readConfig(target);

  for (const [name, productConfig] of Object.entries(config?.products ?? {})) {
    const path = resolve(productDirOf({ target, product: name }), 'tsconfig.json');

    if (!existsSync(path) || !hasDeadDesignSystem(path)) continue;

    writeEditorTsconfig({ target, product: resolveProduct({ target, name, config: productConfig }) });
  }
};

const hasDeadDesignSystem = (path: string) => {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { compilerOptions?: { paths?: Record<string, string[]> } };
    const file = parsed.compilerOptions?.paths?.[DESIGN_SYSTEM_SPECIFIER]?.[0];

    return file !== undefined && !existsSync(file);
  } catch {
    return true;
  }
};

const jsonTextOf = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const systemTsconfigOf = (options: {
  target: string;
  product: ResolvedProduct & SharedDirs;
  assetRoot?: string;
  include?: string[];
}) => {
  const { target, product, assetRoot = installedAssetRoot(), include = [] } = options;
  const defineCall = resolve(assetRoot, 'define-call.ts');
  const definePart = resolve(assetRoot, 'define-part.ts');
  const inlineCss = resolve(assetRoot, 'css-inline.d.ts');
  const assets = resolve(assetRoot, 'assets.d.ts');
  const kit = resolve(assetRoot, 'wireframe-kit.ts');
  const typePaths = typePathsOf({ packages: renderPackagesOf({ target, config: readConfig(target) }), target });
  const partPaths = Object.fromEntries(product.parts.map((part) => [partSpecifierOf(part), [part.file]]));
  const fixtures = product.fixtures ? [product.fixtures] : [];
  const productShared = productSharedDirsOf(product);
  const sharedDirs = sharedDirsOf(product).filter((dir) => !productShared.includes(dir) || existsSync(dir));
  const shared = sharedDirs.map((dir) => resolve(dir, '**/*.ts'));

  const config = {
    compilerOptions: {
      ...DRAWING_COMPILER_OPTIONS,
      paths: {
        ...typePaths,
        ...partPaths,
        ...(product.fixtures ? { [FIXTURES_SPECIFIER]: [product.fixtures] } : {}),
        [DESIGN_SYSTEM_SPECIFIER]: [definePart],
        [KIT_SPECIFIER]: [kit],
        ...(sharedDirs.length > 0 ? { [`${SHARED_PREFIX}*`]: sharedDirs.map((dir) => resolve(dir, '*')) } : {}),
      },
    },
    include: [
      ...include.map((dir) => resolve(dir, '**/*.ts')),
      ...product.parts.map((part) => part.file),
      ...fixtures,
      ...shared,
      definePart,
      kit,
      defineCall,
      inlineCss,
      assets,
    ],
  };

  return config;
};
