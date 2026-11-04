import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { filesBelow } from '../assets';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { EDIT_SKETCH } from './merged-parts';
import { createSketch, markSketchReady, rewriteSharedImports, Sketch } from './sketch';

const OLD = 'old';
const NEW = 'new';

const git = (root: string, args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });

const headFilesOf = (root: string, dir: string): Map<string, string> | string => {
  try {
    const paths = git(root, ['ls-tree', '-r', '--name-only', 'HEAD', '--', `./${dir}`])
      .split('\n')
      .filter((line) => line !== '');

    return new Map(paths.map((path) => [relative(dir, path), git(root, ['show', `HEAD:./${path}`])]));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Opens the old/new sketch of a merged part edited outside a sketch, ready for a pick: `old` holds the part's design at
 * HEAD, `new` the working one. Answers the sketch, or why it cannot open.
 */
export const openEditSketch = (options: {
  target: string;
  product: ResolvedProduct;
  part: string;
  author?: string;
}): Sketch | string => {
  const { target, product, part } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;

  const root = repoRootOf(product);
  const partDir = dirname(resolved.file);
  const head = headFilesOf(root, relative(root, partDir));

  if (typeof head === 'string') return `${part} has no design at HEAD to compare with: ${head}`;
  if (head.size === 0) return `${part} is not in HEAD - there is no old design to show`;

  const working = filesBelow(partDir);
  const unchanged =
    working.length === head.size &&
    working.every((file) => head.get(relative(partDir, file)) === readFileSync(file, 'utf8'));

  if (unchanged) return `HEAD holds the edit of ${part} already - there is no old design to show`;

  const created = createSketch({
    product,
    sketch: { layer: resolved.layer, name: resolved.name, sketch: EDIT_SKETCH },
    variants: [NEW, OLD],
    roundTitle: 'Direct edit',
    roundNote: `${part} changed outside a sketch and looks different - pick the design at HEAD or the edit`,
    variantNotes: new Map([
      [OLD, 'the design at HEAD'],
      [NEW, 'the edit made outside a sketch'],
    ]),
    author: options.author,
    merge: resolved.origin === 'overridden' ? 'override' : undefined,
  });

  if (typeof created === 'string') return created;

  const oldDir = resolve(created.dir, OLD, resolved.layer, resolved.name);

  rmSync(oldDir, { recursive: true, force: true });

  for (const [path, source] of head) {
    const file = resolve(oldDir, path);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }

  if (existsSync(resolve(oldDir, 'shared'))) {
    rewriteSharedImports(oldDir);
    rmSync(resolve(oldDir, 'shared'), { recursive: true });
  }

  return markSketchReady({ checkout: target, sketch: created, author: options.author });
};
