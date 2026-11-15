import { existsSync, readFileSync } from 'fs';
import { basename } from 'path';
import { readConfig } from './design-config';
import { gitStatusOf } from './git-reader';
import { READY_FILE } from './system/part-ready';
import { ResolvedProduct } from './system/resolve-product';
import { oneProductOf } from './system/sketch/cli-args';
import { isStaleEditSketch } from './system/sketch/edit-sketch';
import { leftoverSketchFoldersOf, listSketches } from './system/sketch/sketch';

type ReadyEntries = Record<string, { hash?: unknown }>;

const entriesOf = (text: string | null): ReadyEntries => {
  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ReadyEntries) : {};
  } catch {
    return {};
  }
};

const gitIn = (dir: string, args: string[]) => {
  const run = gitStatusOf(args, { cwd: dir, stdio: 'pipe' });

  return run.status === 0 ? run.stdout : null;
};

const isMark = (entry: { hash?: unknown } | undefined) => typeof entry?.hash === 'string';

const readyLinesOf = (product: ResolvedProduct) => {
  const file = `${product.dir}/${READY_FILE}`;
  const now = entriesOf(existsSync(file) ? readFileSync(file, 'utf8') : null);
  const head = entriesOf(gitIn(product.dir, ['show', `HEAD:./${READY_FILE}`]));
  const line = (part: string, what: string) =>
    `READY UNCOMMITTED ${product.name} ${part}: ${what} - commit ${READY_FILE} or the mark is lost`;

  return [...new Set([...Object.keys(head), ...Object.keys(now)])].sort().flatMap((part) => {
    const [before, after] = [head[part], now[part]];

    if (isMark(after) && !isMark(before)) return [line(part, 'marked ready, HEAD has no mark')];
    if (!isMark(after) && isMark(before)) return [line(part, 'the mark HEAD holds is gone')];
    if (isMark(after) && JSON.stringify(after) !== JSON.stringify(before))
      return [line(part, 'the mark differs from HEAD')];

    return [];
  });
};

const sketchLinesOf = (product: ResolvedProduct) => {
  const tracked = gitIn(product.dir, ['ls-files', '-z', '--', 'sketches']);
  const trackedFolders = new Set((tracked ?? '').split('\0').map((path) => path.split('/')[1]));
  const discard = (target: string) => `sketch discard ${target} --product ${product.name} --by <model id>`;

  const sketches = listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) => {
    if (typeof sketch === 'string') return [];

    const folder = basename(sketch.dir);
    const about = `${sketch.target}, ${sketch.status}, created ${sketch.createdAt.slice(0, 10)}`;

    if (isStaleEditSketch(product, sketch))
      return [
        `SKETCH LEFTOVER ${product.name} ${folder}: ${about} - its part matches HEAD, discard it: ${discard(sketch.target)}`,
      ];
    if (tracked !== null && !trackedFolders.has(folder))
      return [`SKETCH UNTRACKED ${product.name} ${folder}: ${about} - commit it or discard it`];

    return [];
  });
  const empty = leftoverSketchFoldersOf(product.dir).map(
    (dir) => `SKETCH LEFTOVER ${product.name} ${basename(dir)}: holds no sketch file - delete the folder`,
  );

  return [...sketches, ...empty];
};

/**
 * One line per ready mark in a product's `ready.json` that differs from HEAD, and per sketch folder git does not track
 * or that is left over: empty, or a direct-edit sketch whose part HEAD holds.
 */
export const uncommittedLinesOf = (target: string) => {
  const config = readConfig(target);

  return Object.keys(config?.products ?? {}).flatMap((name) => {
    const product = config ? oneProductOf({ target, config, asked: name }) : null;

    return product && typeof product !== 'string' && gitIn(product.dir, ['rev-parse', '--verify', '-q', 'HEAD'])
      ? [...readyLinesOf(product), ...sketchLinesOf(product)]
      : [];
  });
};
