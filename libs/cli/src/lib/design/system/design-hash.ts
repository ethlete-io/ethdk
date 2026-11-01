import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, relative, sep } from 'path';
import { importedAssetsOf } from './assets';
import { FIXTURES_SPECIFIER } from './imports';
import { partOwnerOf } from './inventory-approval';
import { reachableFilesOf, repoRootOf } from './reachable-files';
import { ResolvedPart, ResolvedProduct } from './resolve-product';
import { partHashOf, partInputsOf } from './sketch/baseline';
import { importsOf } from './ts-source';

/** The content hash of each file, under its path from the repository root. */
export type FileHashes = Record<string, string>;

/** A part's design hash, the file hashes it covers, and the folder-only hash records from before file lists. */
export type DesignHash = { hash: string; files: FileHashes; legacy: string };

/** A stored mark: one with `files` holds at the design hash, one without at the folder-only hash. */
export type HashRecord = { hash: string; files?: FileHashes };

const sha16 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16);

const isFileHashes = (value: unknown): value is FileHashes =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every((hash) => typeof hash === 'string');

/** Whether a stored `files` value is absent or a valid file hash map, for the readers of the mark files. */
export const isOptionalFileHashes = (value: unknown) => value === undefined || isFileHashes(value);

/** The hash of each existing file in `files`, keyed by its `/`-separated path from `root`, sorted. */
export const fileHashesOf = (root: string, files: Iterable<string>): FileHashes =>
  Object.fromEntries(
    [...new Set(files)]
      .map((file) => [relative(root, file).split(sep).join('/'), file] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([path, file]) => {
        try {
          return [[path, sha16(readFileSync(file))]];
        } catch {
          return [];
        }
      }),
  );

export const hashOfFiles = (files: FileHashes) =>
  sha16(
    Object.entries(files)
      .map(([path, hash]) => `${path}\0${hash}\n`)
      .join(''),
  );

/**
 * The design hash of a part: its folder, the shared and asset files it reaches, and every file it reaches through
 * imports - other `@system` parts, `@ethlete/<lib>/design` mocks and the fixtures - with the hash of each file.
 */
export const designHashOf = (options: { product: ResolvedProduct; part: ResolvedPart }): DesignHash => {
  const { product, part } = options;
  const owner = partOwnerOf({ product, part });
  const dir = dirname(part.file);
  const inputs = partInputsOf({ product: owner, dir });
  const reachable = reachableFilesOf(product, [part]);
  const reached = [...reachable.files.keys()];
  const fixtures =
    product.fixtures && [...reachable.files.values()].some((source) => importsOf(source).includes(FIXTURES_SPECIFIER))
      ? [product.fixtures]
      : [];
  const files = [
    ...inputs.files,
    ...inputs.shared.map(({ file }) => file),
    ...inputs.assets.map(({ file }) => file),
    ...reached,
    ...importedAssetsOf({ product: owner, files: reached }).map(({ file }) => file),
    ...reachable.sdkDesign.keys(),
    ...fixtures,
  ].filter((file) => !inputs.generated.has(file));
  const hashes = fileHashesOf(repoRootOf(product), files);

  return { hash: hashOfFiles(hashes), files: hashes, legacy: partHashOf({ product: owner, dir }) };
};

export const recordHolds = (record: HashRecord, now: DesignHash) =>
  record.files ? record.hash === now.hash : record.hash === now.legacy;

/** The paths whose hash differs between two file hash maps, added and removed paths included, sorted. */
export const changedFilesOf = (before: FileHashes, now: FileHashes) =>
  [...new Set([...Object.keys(before), ...Object.keys(now)])]
    .filter((path) => before[path] !== now[path])
    .sort((a, b) => a.localeCompare(b));
