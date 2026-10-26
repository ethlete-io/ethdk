import { existsSync, readFileSync } from 'fs';
import { LAYER_USES, LAYERS } from '../layers';
import { fixturesOf, partFilesOf } from '../product';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { Sketch, variantDirOf } from './sketch';

export type SketchedProduct = ResolvedProduct & { sketched: string[] };

const mayChange = (sketch: Sketch, part: { layer: (typeof LAYERS)[number]; name: string }) =>
  partKeyOf(part) === sketch.target || part.layer === sketch.layer || LAYER_USES[sketch.layer].includes(part.layer);

/**
 * The product as one variant of a sketch draws it: each part the variant holds replaces the part the
 * product resolves under the same name, or joins it when the product has none. `sketched` names the
 * parts the variant holds.
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
  const outside: Problem[] = sketched
    .filter((part) => !mayChange(sketch, part))
    .map((part) => ({
      rule: 'SKETCH',
      file: part.file,
      message: `a sketch on ${sketch.target} may change ${sketch.layer} and the layers below it, not ${partKeyOf(part)}`,
    }));

  return {
    ...product,
    parts,
    fixtures: fixturesOf(dir) ?? product.fixtures,
    problems: [...product.problems, ...own.problems, ...outside],
    sketched: [...keys],
  };
};
