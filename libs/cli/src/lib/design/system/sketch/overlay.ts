import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ASSETS_FOLDER } from '../assets';
import { Layer, LAYER_USES, LAYERS } from '../layers';
import { fixturesOf, partFilesOf } from '../product';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { changesOnlyImports, importsAnyOf } from './host-edit';
import { Sketch, sharedDirOf, variantDirOf, variantSharedDirOf } from './sketch';

export type SketchedProduct = ResolvedProduct & {
  sketched: string[];
  sharedDir: string;
  variantSharedDir: string;
  assetsDir: string;
};

const mayChange = (sketch: Sketch, part: { layer: (typeof LAYERS)[number]; name: string }) =>
  sketch.targets.some((key) => {
    const layer = key.split('/')[0] as Layer;

    return key === partKeyOf(part) || part.layer === layer || LAYER_USES[layer].includes(part.layer);
  });

/**
 * The product as one variant of a sketch draws it: each part the variant holds replaces the part the
 * product resolves under the same name, or joins it when the product has none. `sketched` names the
 * parts the variant holds, `sharedDir` the sketch's `shared/` folder its parts import as `@shared/...` (the
 * variant's own `variantSharedDir` first), and
 * `assetsDir` the variant's own `assets/` folder, which `@assets/...` looks in first.
 */
export const overlaySketch = (options: {
  product: ResolvedProduct;
  sketch: Sketch;
  variant: string;
}): SketchedProduct => {
  const { product, sketch, variant } = options;
  const dir = variantDirOf(sketch, variant);
  const own = partFilesOf(dir);
  const baseKeys = new Set(product.parts.filter((part) => part.origin !== 'product').map(partKeyOf));
  const sketched = own.parts.map((file): ResolvedPart => ({
    ...file,
    origin: baseKeys.has(partKeyOf(file)) ? 'overridden' : 'product',
    source: readFileSync(file.file, 'utf8'),
    cssSource: file.css && existsSync(file.css) ? readFileSync(file.css, 'utf8') : null,
  }));
  const keys = new Set(sketched.map(partKeyOf));
  const parts = [...product.parts.filter((part) => !keys.has(partKeyOf(part))), ...sketched].sort(
    (a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || a.name.localeCompare(b.name),
  );
  const isImportOnlyHostEdit = (part: ResolvedPart) => {
    const before = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(part));

    return (
      before !== undefined &&
      before.cssSource === part.cssSource &&
      importsAnyOf(before.source, sketch.targets) &&
      changesOnlyImports(before.source, part.source)
    );
  };
  const outside: Problem[] = sketched
    .filter((part) => !mayChange(sketch, part) && !isImportOnlyHostEdit(part))
    .map((part) => ({
      rule: 'SKETCH',
      file: part.file,
      message: `${
        sketch.targets.length > 1
          ? `a sketch on ${sketch.targets.join(', ')} may change their layers and the layers below them, not ${partKeyOf(part)}`
          : `a sketch on ${sketch.target} may change ${sketch.layer} and the layers below it, not ${partKeyOf(part)}`
      }${importsAnyOf(part.source, sketch.targets) ? ' - a host of it may change only its imports' : ''}`,
    }));

  return {
    ...product,
    parts,
    fixtures: fixturesOf(dir) ?? product.fixtures,
    problems: [...product.problems, ...own.problems, ...outside],
    sketched: [...keys],
    sharedDir: sharedDirOf(sketch),
    variantSharedDir: variantSharedDirOf(sketch, variant),
    assetsDir: resolve(dir, ASSETS_FOLDER),
  };
};
