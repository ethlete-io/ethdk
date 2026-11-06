import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, relative, resolve, sep } from 'path';
import { filesBelow } from '../assets';
import { fixturesOf, partFilesOf } from '../product';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { conflictsOf, FIXTURES_KEY, partHashOf } from './baseline';
import {
  SHARED_FOLDER,
  sharedDirOf,
  Sketch,
  SOURCE_FILE,
  variantDirOf,
  variantSharedDirOf,
  withSharedImports,
} from './sketch';

const CANDIDATE_COMMITS = 60;

export type PortedFile = { variant: string; part: string; file: string; how: 'merged' | 'taken' | 'deleted' };

export type BasePort = { ported: PortedFile[]; conflicts: string[] };

type Write = { path: string; content: Buffer | null };

const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'pipe'] });

const posix = (path: string) => path.split(sep).join('/');

const readOrNull = (path: string) => (existsSync(path) ? readFileSync(path) : null);

const sameBytes = (a: Buffer | null, b: Buffer | null) => (a === null || b === null ? a === b : a.equals(b));

const heldPathOf = (options: { name: string; heldDir: string; sharedDirs: string[] }) => {
  const { name, heldDir, sharedDirs } = options;
  const own = resolve(heldDir, name);
  const prefix = `${SHARED_FOLDER}${sep}`;

  if (!name.startsWith(prefix) || existsSync(own)) return own;

  const lifted = sharedDirs.map((dir) => resolve(dir, name.slice(prefix.length)));

  return lifted.find((path) => existsSync(path)) ?? own;
};

const asHeldOf = (options: { name: string; heldDir: string }) => (content: Buffer | null) =>
  content && SOURCE_FILE.test(options.name)
    ? Buffer.from(
        withSharedImports({
          source: content.toString('utf8'),
          file: resolve(options.heldDir, options.name),
          partDir: options.heldDir,
        }),
      )
    : content;

/**
 * The folder of `part` as the commit whose state hashes to `hash` held it, extracted below `scratch`, or `null` when
 * none of the last commits that touched the product does.
 */
const oldBaseDirOf = (options: {
  top: string;
  product: ResolvedProduct;
  partDir: string;
  hash: string;
  scratch: string;
}) => {
  const { top, product, partDir, hash, scratch } = options;
  const inRepo = (dir: string) => !relative(top, dir).startsWith('..');
  const owners = [product.dir, ...(product.base && inRepo(product.base.dir) ? [product.base.dir] : [])];
  const paths = [
    posix(relative(top, partDir)),
    ...owners.flatMap((dir) => ['shared', 'assets'].map((folder) => posix(relative(top, resolve(dir, folder))))),
  ];
  const commits = git(top, ['log', `-n${CANDIDATE_COMMITS}`, '--format=%H', '--', ...paths])
    .toString()
    .split('\n')
    .filter(Boolean);

  for (const commit of commits) {
    const files = git(top, ['ls-tree', '-r', '--name-only', commit, '--', ...paths])
      .toString()
      .split('\n')
      .filter(Boolean);

    if (files.length === 0) continue;

    const root = resolve(scratch, commit);

    if (!existsSync(root)) {
      mkdirSync(root, { recursive: true });
      execFileSync('tar', ['-x', '-C', root], { input: git(top, ['archive', '--format=tar', commit, '--', ...files]) });
    }

    const moved = (dir: string) => (inRepo(dir) ? resolve(root, relative(top, dir)) : dir);
    const atCommit = {
      dir: moved(product.dir),
      config: product.config,
      base: product.base ? { dir: moved(product.base.dir), config: product.base.config } : null,
    };
    const oldDir = moved(partDir);

    if (existsSync(oldDir) && partHashOf({ product: atCommit, dir: oldDir }) === hash) return oldDir;
  }

  return null;
};

const mergedOf = (options: { scratch: string; ours: Buffer; base: Buffer; theirs: Buffer }) => {
  const { scratch, ours, base, theirs } = options;
  const dir = mkdtempSync(resolve(scratch, 'merge-'));
  const oursFile = resolve(dir, 'variant');
  const baseFile = resolve(dir, 'old-base');
  const theirsFile = resolve(dir, 'new-base');

  writeFileSync(oursFile, ours);
  writeFileSync(baseFile, base);
  writeFileSync(theirsFile, theirs);

  const result = spawnSync('git', ['merge-file', '-p', oursFile, baseFile, theirsFile], { maxBuffer: 1 << 28 });

  return result.status === 0 ? result.stdout : null;
};

const linesOf = (content: Buffer) => content.toString('utf8').split(/(?<=\n)/u);

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

const hunksOf = (options: { scratch: string; old: Buffer; fresh: Buffer }) => {
  const dir = mkdtempSync(resolve(options.scratch, 'hunks-'));
  const oldFile = resolve(dir, 'old-base');
  const freshFile = resolve(dir, 'new-base');

  writeFileSync(oldFile, options.old);
  writeFileSync(freshFile, options.fresh);

  const diff = spawnSync('git', ['diff', '--no-index', '--no-color', '-U0', oldFile, freshFile], {
    maxBuffer: 1 << 28,
  });

  return diff.stdout
    .toString('utf8')
    .split('\n')
    .flatMap((line) => {
      const match = HUNK_HEADER.exec(line);

      if (!match) return [];

      const [, from = '0', removed = '1', to = '0', added = '1'] = match;

      return [{ from: Number(from), removed: Number(removed), to: Number(to), added: Number(added) }];
    });
};

const withoutHeldHunks = (options: { scratch: string; mine: Buffer; old: Buffer; fresh: Buffer }) => {
  const text = options.mine.toString('utf8');
  const oldLines = linesOf(options.old);
  const freshLines = linesOf(options.fresh);
  const holds = (lines: string[]) => lines.length > 0 && text.includes(lines.join(''));
  const out: string[] = [];
  let at = 0;

  for (const hunk of hunksOf(options)) {
    const start = hunk.removed === 0 ? hunk.from : hunk.from - 1;
    const addedStart = hunk.added === 0 ? hunk.to : hunk.to - 1;
    const removed = oldLines.slice(start, start + hunk.removed);
    const added = freshLines.slice(addedStart, addedStart + hunk.added);
    const held = added.some((line) => /\w/u.test(line)) && holds(added) && !holds(removed);

    out.push(...oldLines.slice(at, start), ...(held ? removed : added));
    at = start + hunk.removed;
  }

  out.push(...oldLines.slice(at));

  return Buffer.from(out.join(''));
};

/**
 * Ports the changes the product made to each part the sketch's variants replace since its baseline into those
 * variants: a 3-way merge per file of the variant, the part as the baseline held it (found in git history by its
 * hash) and the part now. Writes nothing when any file conflicts or a baseline state is not in history, and then
 * answers with the conflicts; with `keepConflicts` it keeps the variant's version of those and ports the rest.
 */
export const portBaseChanges = (options: {
  target: string;
  product: ResolvedProduct;
  sketch: Sketch;
  keepConflicts?: boolean;
}): BasePort => {
  const { target, product, sketch, keepConflicts } = options;
  const baseline = sketch.baseline ?? {};
  let top: string | null = null;
  const scratch = mkdtempSync(resolve(tmpdir(), 'et-sketch-rebase-'));
  const writes = new Map<string, Write>();
  const ported: PortedFile[] = [];
  const conflicts: string[] = [];

  try {
    for (const variant of sketch.variants) {
      const variantDir = variantDirOf(sketch, variant);

      if (
        fixturesOf(variantDir) !== null &&
        conflictsOf({ product, baseline, parts: [], fixtures: true }).includes(FIXTURES_KEY)
      )
        conflicts.push(`${variant}: ${FIXTURES_KEY} changed in the product, port it by hand`);

      for (const held of partFilesOf(variantDir).parts) {
        const part = partKeyOf(held);
        const now = product.parts.find((candidate) => partKeyOf(candidate) === part);

        if (!now || baseline[part] === undefined) continue;

        const partDir = dirname(now.file);

        if (partHashOf({ product, dir: partDir }) === baseline[part]) continue;

        top ??= git(target, ['rev-parse', '--show-toplevel']).toString().trim();

        const oldDir = oldBaseDirOf({ top, product, partDir, hash: baseline[part], scratch });

        if (oldDir === null) {
          conflicts.push(`${variant}: ${part} - no commit holds the state the baseline recorded, port it by hand`);
          continue;
        }

        const heldDir = dirname(held.file);
        const names = [
          ...new Set([oldDir, partDir].flatMap((dir) => filesBelow(dir).map((file) => relative(dir, file)))),
        ].sort();

        const sharedDirs = [variantSharedDirOf(sketch, variant), sharedDirOf(sketch)];

        for (const name of names) {
          const asHeld = asHeldOf({ name, heldDir });
          const old = asHeld(readOrNull(resolve(oldDir, name)));
          const fresh = asHeld(readOrNull(resolve(partDir, name)));
          const path = heldPathOf({ name, heldDir, sharedDirs });
          const mine = readOrNull(path);
          const file = `${part}/${posix(name)}`;

          if (sameBytes(old, fresh) || sameBytes(mine, fresh)) continue;

          if (sameBytes(mine, old)) {
            writes.set(path, { path, content: fresh });
            ported.push({ variant, part, file, how: fresh === null ? 'deleted' : 'taken' });
            continue;
          }

          const theirs = mine && old && fresh ? withoutHeldHunks({ scratch, mine, old, fresh }) : fresh;

          if (sameBytes(theirs, old)) continue;

          const merged = mine && old && theirs ? mergedOf({ scratch, ours: mine, base: old, theirs }) : null;

          if (merged === null) {
            conflicts.push(`${variant}: ${file} - the variant and the product both changed it`);
            continue;
          }

          if (merged.equals(mine as Buffer)) continue;

          writes.set(path, { path, content: merged });
          ported.push({ variant, part, file, how: 'merged' });
        }
      }
    }

    if (conflicts.length > 0 && !keepConflicts) return { ported: [], conflicts };

    for (const { path, content } of writes.values()) {
      if (content === null) rmSync(path, { force: true });
      else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
    }

    return { ported, conflicts };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};
