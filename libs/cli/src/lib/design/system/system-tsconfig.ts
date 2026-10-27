import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { DRAWING_COMPILER_OPTIONS } from '../calls-tsconfig';
import { assetRoot, readConfig, workRootOf } from '../paths';
import { typePathsOf } from '../render-packages';
import { FIXTURES_SPECIFIER, partSpecifierOf } from './imports';
import { KIT_SPECIFIER } from './kit';
import { ResolvedProduct } from './resolve-product';

export const DESIGN_SYSTEM_SPECIFIER = '@design-system';

/**
 * Writes the tsconfig that types one product's design system, and answers with its path. Each
 * `@system/<layer>/<name>` maps to the part the product resolves, so an override also replaces
 * the part inside the base parts that import it.
 */
export const writeSystemTsconfig = (options: { target: string; product: ResolvedProduct }) => {
  const { target, product } = options;
  const work = workRootOf(target);
  const path = resolve(work, `system-${product.name}.tsconfig.json`);
  const defineCall = resolve(assetRoot(), 'define-call.ts');
  const definePart = resolve(assetRoot(), 'define-part.ts');
  const inlineCss = resolve(assetRoot(), 'css-inline.d.ts');
  const kit = resolve(assetRoot(), 'wireframe-kit.ts');
  const typePaths = typePathsOf({ packages: readConfig(target)?.render?.packages ?? {}, target });
  const partPaths = Object.fromEntries(product.parts.map((part) => [partSpecifierOf(part), [part.file]]));
  const fixtures = product.fixtures ? [product.fixtures] : [];

  const config = {
    compilerOptions: {
      ...DRAWING_COMPILER_OPTIONS,
      paths: {
        ...typePaths,
        ...partPaths,
        ...(product.fixtures ? { [FIXTURES_SPECIFIER]: [product.fixtures] } : {}),
        [DESIGN_SYSTEM_SPECIFIER]: [definePart],
        [KIT_SPECIFIER]: [kit],
      },
    },
    include: [...product.parts.map((part) => part.file), ...fixtures, definePart, kit, defineCall, inlineCss],
  };

  mkdirSync(work, { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);

  return path;
};
