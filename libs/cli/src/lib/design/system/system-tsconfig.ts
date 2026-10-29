import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { typecheck, TypecheckResult } from '../typecheck';
import { DRAWING_COMPILER_OPTIONS } from '../calls-tsconfig';
import { installedAssetRoot, readConfig, workRootOf } from '../paths';
import { typePathsOf } from '../render-packages';
import { FIXTURES_SPECIFIER, partSpecifierOf, SHARED_PREFIX } from './imports';
import { KIT_SPECIFIER } from './kit';
import { ResolvedProduct } from './resolve-product';

export const DESIGN_SYSTEM_SPECIFIER = '@design-system';

/**
 * Writes the tsconfig that types one product's design system, and answers with its path. Each
 * `@system/<layer>/<name>` maps to the part the product resolves, so an override also replaces
 * the part inside the base parts that import it.
 */
export const writeSystemTsconfig = (options: { target: string; product: ResolvedProduct & { sharedDir?: string } }) => {
  const { target, product } = options;
  const work = workRootOf(target);
  const path = resolve(work, `system-${product.name}.tsconfig.json`);

  mkdirSync(work, { recursive: true });
  writeFileSync(path, systemTsconfigText({ target, product }));

  return path;
};

/** The one typecheck of a product, shared by `design check` and every sketch variant. */
export const typecheckProduct = (options: {
  target: string;
  product: ResolvedProduct & { sharedDir?: string };
}): TypecheckResult => typecheck({ target: options.target, tsconfig: writeSystemTsconfig(options) });

/**
 * Writes `tsconfig.json` into the product's own folder, the nearest tsconfig an editor finds for
 * its parts, so `@design-system` and `@system/*` resolve there. The file is gitignored.
 */
export const writeEditorTsconfig = (options: { target: string; product: ResolvedProduct }) => {
  if (!existsSync(options.product.dir)) return;

  writeFileSync(resolve(options.product.dir, 'tsconfig.json'), systemTsconfigText(options));
};

const systemTsconfigText = (options: { target: string; product: ResolvedProduct & { sharedDir?: string } }) => {
  const { target, product } = options;
  const defineCall = resolve(installedAssetRoot(), 'define-call.ts');
  const definePart = resolve(installedAssetRoot(), 'define-part.ts');
  const inlineCss = resolve(installedAssetRoot(), 'css-inline.d.ts');
  const assets = resolve(installedAssetRoot(), 'assets.d.ts');
  const kit = resolve(installedAssetRoot(), 'wireframe-kit.ts');
  const typePaths = typePathsOf({ packages: readConfig(target)?.render?.packages ?? {}, target });
  const partPaths = Object.fromEntries(product.parts.map((part) => [partSpecifierOf(part), [part.file]]));
  const fixtures = product.fixtures ? [product.fixtures] : [];
  const shared = product.sharedDir ? [resolve(product.sharedDir, '**/*.ts')] : [];

  const config = {
    compilerOptions: {
      ...DRAWING_COMPILER_OPTIONS,
      paths: {
        ...typePaths,
        ...partPaths,
        ...(product.fixtures ? { [FIXTURES_SPECIFIER]: [product.fixtures] } : {}),
        [DESIGN_SYSTEM_SPECIFIER]: [definePart],
        [KIT_SPECIFIER]: [kit],
        ...(product.sharedDir ? { [`${SHARED_PREFIX}*`]: [resolve(product.sharedDir, '*')] } : {}),
      },
    },
    include: [
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

  return `${JSON.stringify(config, null, 2)}\n`;
};
