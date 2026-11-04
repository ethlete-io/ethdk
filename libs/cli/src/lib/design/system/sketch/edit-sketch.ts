import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { filesBelow } from '../assets';
import { repoRootOf } from '../reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';
import { EDIT_SKETCH } from './merged-parts';
import {
  createSketch,
  markSketchReady,
  rewriteSharedImports,
  SHARED_FOLDER,
  Sketch,
  variantSharedDirOf,
} from './sketch';

export const EDIT_OLD = 'old';
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

  const head = headOf(product, resolved);

  if (typeof head === 'string') return head;

  const partDir = dirname(resolved.file);
  const working = filesBelow(partDir);
  const unchanged =
    working.length === head.size &&
    working.every((file) => head.get(relative(partDir, file)) === readFileSync(file, 'utf8'));

  if (unchanged) return `HEAD holds the edit of ${part} already - there is no old design to show`;

  const created = createSketch({
    product,
    sketch: { layer: resolved.layer, name: resolved.name, sketch: EDIT_SKETCH },
    variants: [NEW, EDIT_OLD],
    roundTitle: 'Direkte Änderung',
    roundNote: `${part} wurde außerhalb eines Sketches geändert und sieht anders aus - wähle den Stand von HEAD oder die Änderung`,
    variantNotes: new Map([
      [EDIT_OLD, 'der Stand von HEAD'],
      [NEW, 'die Änderung außerhalb eines Sketches'],
    ]),
    author: options.author,
    merge: resolved.origin === 'overridden' ? 'override' : undefined,
  });

  if (typeof created === 'string') return created;

  writeOld({ sketch: created, resolved }, head);

  return markSketchReady({ checkout: target, sketch: created, author: options.author });
};

/**
 * Rewrites the `old` variant of an edit sketch from the part at HEAD, so `old` draws against the sketch's `shared/` of
 * today. Answers why it cannot, else null.
 */
export const refreshEditOld = ({ product, sketch }: { product: ResolvedProduct; sketch: Sketch }): string | null => {
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === partKeyOf(sketch));

  if (!resolved) return `product "${product.name}" has no part "${partKeyOf(sketch)}"`;

  const head = headOf(product, resolved);

  if (typeof head === 'string') return head;

  writeOld({ sketch, resolved }, head);

  return null;
};

const headOf = (product: ResolvedProduct, resolved: ResolvedPart): Map<string, string> | string => {
  const part = partKeyOf(resolved);
  const root = repoRootOf(product);
  const head = headFilesOf(root, relative(root, dirname(resolved.file)));

  if (typeof head === 'string') return `${part} has no design at HEAD to compare with: ${head}`;
  if (head.size === 0) return `${part} is not in HEAD - there is no old design to show`;

  return head;
};

const writeOld = ({ sketch, resolved }: { sketch: Sketch; resolved: ResolvedPart }, head: Map<string, string>) => {
  const oldDir = resolve(sketch.dir, EDIT_OLD, resolved.layer, resolved.name);

  rmSync(oldDir, { recursive: true, force: true });
  rmSync(variantSharedDirOf(sketch, EDIT_OLD), { recursive: true, force: true });

  for (const [path, source] of head) {
    const file = resolve(oldDir, path);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }

  if (existsSync(resolve(oldDir, SHARED_FOLDER))) {
    rewriteSharedImports(oldDir);
    cpSync(resolve(oldDir, SHARED_FOLDER), variantSharedDirOf(sketch, EDIT_OLD), { recursive: true });
    rmSync(resolve(oldDir, SHARED_FOLDER), { recursive: true });
  }
};
