import { execFileSync } from 'child_process';
import { writeJsonFile } from '../../json-file';
import { dirname, relative, resolve, sep } from 'path';
import { appFilesOf } from './app-files';
import { changedFilesOf, designHashOf, DesignHash, HashRecord, recordHolds } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { READY_FILE, readReady } from './part-ready';
import { changedAppFilesOf, IMPLEMENTED_FILE, linkedComponentOf, readImplemented } from './part-task';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';

export const UNLISTED_FILES = 'files unknown: recorded before file lists';

/** A recorded or done part whose design or app files moved since its records, with the changed paths of each side. */
export type StalePart = { part: string; design: string[]; app: string[] };

const changedSinceOf = (record: HashRecord, now: DesignHash) =>
  recordHolds(record, now) ? [] : record.files ? changedFilesOf(record.files, now.files) : [UNLISTED_FILES];

const partsOf = (product: ResolvedProduct, only?: string) =>
  product.parts.filter((part) => !only || partKeyOf(part) === only);

/**
 * The parts with a check record or an implemented record whose design hash moved since the check record, or whose app
 * component files moved since the implemented record.
 */
export const stalePartsOf = (options: { product: ResolvedProduct; only?: string }): StalePart[] =>
  partsOf(options.product, options.only).flatMap((resolved) => {
    const { product } = options;
    const part = partKeyOf(resolved);
    const { dir } = partOwnerOf({ product, part: resolved });
    const ready = readReady(dir)[part];
    const implemented = readImplemented(dir)[part];

    if (!ready && !implemented) return [];

    const now = designHashOf({ product, part: resolved });
    const design = (ready ? changedSinceOf(ready, now) : []).sort((a, b) => a.localeCompare(b));
    const app = implemented ? changedAppFilesOf({ product, part, record: implemented }) : [];

    return design.length > 0 || app.length > 0 ? [{ part, design, app }] : [];
  });

export const staleLineOf = (product: string, stale: StalePart) =>
  `STALE ${product} ${stale.part}: ${[
    stale.design.length > 0 ? `design ${stale.design.join(', ')}` : '',
    stale.app.length > 0 ? `app ${stale.app.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ')}`;

export const UNCOMPARED_RULE = 'IMPLEMENTATION-UNCOMPARED';

/**
 * One problem per file in `changed` that an implemented part's app component reaches and that moved since the part's
 * implemented record, so an app edit cannot land without a fresh compare.
 */
export const uncomparedAppProblemsOf = (options: {
  product: ResolvedProduct;
  changed: string[];
  invocation: string;
}): Problem[] => {
  const { product, invocation } = options;
  const changed = new Set(options.changed);
  const root = repoRootOf(product);

  return product.parts
    .filter((resolved) => resolved.origin !== 'base')
    .flatMap((resolved) => {
      const part = partKeyOf(resolved);
      const record = readImplemented(partOwnerOf({ product, part: resolved }).dir)[part];

      if (!record?.app || !Object.keys(record.app).some((file) => changed.has(file))) return [];

      return changedAppFilesOf({ product, part, record })
        .filter((file) => changed.has(file))
        .map((file) => ({
          rule: UNCOMPARED_RULE,
          file: resolve(root, file),
          message: `changed since ${part} was recorded as implemented (${record.at}) - run ${invocation} compare ${part} --product ${product.name}, then ${invocation} task ${part} --product ${product.name} --verify <rev> to record it`,
        }));
    });
};

const rewrite = (file: string, entries: Record<string, unknown>) => {
  const sorted = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));

  writeJsonFile({ file: file, value: Object.fromEntries(sorted) });
};

const newerThanOf = ({ root, paths, at }: { root: string; paths: string[]; at: string }) => {
  const since = Date.parse(at);

  if (Number.isNaN(since) || paths.length === 0) return paths.length > 0;

  try {
    const git = (args: string[]) =>
      execFileSync('git', ['-C', root, ...args], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] })
        .toString()
        .trim();
    const dirty = git(['status', '--porcelain', '--', ...paths]);

    if (dirty) return true;

    return paths.some((path) => {
      const committed = git(['log', '-1', '--format=%ct', '--', path]);

      return committed === '' || Number(committed) * 1000 > since;
    });
  } catch {
    return true;
  }
};

const upgradeOf = (product: ResolvedProduct, resolved: ResolvedPart) => {
  const part = partKeyOf(resolved);
  const { dir } = partOwnerOf({ product, part: resolved });
  const ready = readReady(dir);
  const implemented = readImplemented(dir);
  const legacy = (record: HashRecord | undefined) => !!record && !record.files;

  if (!legacy(ready[part]) && !(implemented[part] && !implemented[part]?.app)) return [];

  const now = designHashOf({ product, part: resolved });
  const root = repoRootOf(product);
  const folder = `${relative(root, dirname(resolved.file)).split(sep).join('/')}/`;
  const outside = Object.keys(now.files).filter((path) => !path.startsWith(folder));
  const holds = (record: (HashRecord & { at: string }) | undefined): record is HashRecord & { at: string } =>
    legacy(record) && record?.hash === now.legacy && !newerThanOf({ root, paths: outside, at: record.at });
  const upgraded: string[] = [];
  const readyEntry = ready[part];
  const implementedEntry = implemented[part];

  if (holds(readyEntry)) {
    rewrite(resolve(dir, READY_FILE), { ...ready, [part]: { ...readyEntry, hash: now.hash, files: now.files } });
    upgraded.push('ready');
  }

  const component = linkedComponentOf(resolved.source);

  if (
    implementedEntry &&
    implementedEntry.hash === now.legacy &&
    !implementedEntry.app &&
    component !== null &&
    !newerThanOf({ root, paths: outside, at: implementedEntry.at })
  ) {
    rewrite(resolve(dir, IMPLEMENTED_FILE), {
      ...implemented,
      [part]: { ...implementedEntry, hash: now.hash, app: appFilesOf({ root: repoRootOf(product), component }) },
    });
    upgraded.push('implemented');
  }

  return upgraded.length > 0 ? [{ part, marks: upgraded }] : [];
};

/**
 * Moves each check record and implemented record stored before file lists to the design hash, with the hash of each
 * file it covers, while its folder-only hash still holds; an implemented record also gets its app file hashes. A
 * record whose folder changed since, or a file it reaches outside its folder that was committed or edited after the
 * record's time, stays as it is and reads as stale.
 */
export const upgradeLegacyMarksOf = (options: { product: ResolvedProduct; only?: string }) =>
  partsOf(options.product, options.only).flatMap((part) => upgradeOf(options.product, part));
