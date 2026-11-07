import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { designPictureCodeOf } from '../code-hash';
import { workRootOf } from '../paths';
import { designHashOf, FileHashes, fileHashesOf, sha16 } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partInputsOf } from './sketch/baseline';

type StatePictures = Record<string, string>;

type Entry = { states: StatePictures; others: FileHashes };

/** The state pictures of the parts of one product, kept outside the checkout by part hash. */
export type PartPictureCache = {
  read: (part: ResolvedPart, partHash: string) => StatePictures | null;
  write: (entry: { part: ResolvedPart; partHash: string; states: StatePictures }) => void;
};

const isEntry = (value: unknown): value is Entry => {
  if (!value || typeof value !== 'object') return false;

  const { states, others } = value as Partial<Entry>;
  const isStrings = (record: unknown) =>
    !!record &&
    typeof record === 'object' &&
    !Array.isArray(record) &&
    Object.values(record).every((hash) => typeof hash === 'string');

  return isStrings(states) && isStrings(others);
};

/**
 * The state pictures of a part drawn at a part hash, kept under `node_modules/.design-explore/part-pictures`. The part
 * hash covers the part folder and the shared and asset files it reaches; an entry also holds the hash of every other
 * file the part was drawn from (embedded parts, kit, tokens, fixtures) and is read only while each of them is unchanged
 * and the design picture code is the same.
 */
export const createPartPictureCache = (options: {
  target: string;
  product: ResolvedProduct;
  code?: string;
}): PartPictureCache => {
  const { target, product } = options;
  const root = repoRootOf(product);
  const code = options.code ?? designPictureCodeOf();
  const fileOf = (part: ResolvedPart, partHash: string) =>
    resolve(
      workRootOf(target),
      'part-pictures',
      `${sha16(`${code}\0${product.name}\0${partKeyOf(part)}\0${partHash}`)}.json`,
    );
  const othersOf = (part: ResolvedPart): FileHashes => {
    const owner = partOwnerOf({ product, part });
    const inputs = partInputsOf({ product: owner, dir: dirname(part.file) });
    const own = new Set(
      Object.keys(
        fileHashesOf(root, [
          ...inputs.files,
          ...inputs.shared.map(({ file }) => file),
          ...inputs.assets.map(({ file }) => file),
        ]),
      ),
    );

    return Object.fromEntries(Object.entries(designHashOf({ product, part }).files).filter(([path]) => !own.has(path)));
  };

  return {
    read: (part, partHash) => {
      let entry: unknown;

      try {
        entry = JSON.parse(readFileSync(fileOf(part, partHash), 'utf8'));
      } catch {
        return null;
      }

      if (!isEntry(entry)) return null;

      const paths = Object.keys(entry.others);
      const now = fileHashesOf(
        root,
        paths.map((path) => resolve(root, path)),
      );

      return paths.every((path) => now[path] === entry.others[path]) ? entry.states : null;
    },
    write: ({ part, partHash, states }) => {
      const file = fileOf(part, partHash);

      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ states, others: othersOf(part) }));
    },
  };
};
