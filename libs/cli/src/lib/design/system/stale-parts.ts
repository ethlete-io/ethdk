import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { appFilesOf } from './app-files';
import { changedFilesOf, designHashOf, DesignHash, HashRecord, recordHolds } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { GO_FILE, readGo } from './part-go';
import { READY_FILE, readReady } from './part-ready';
import { changedAppFilesOf, IMPLEMENTED_FILE, linkedComponentOf, readImplemented } from './part-task';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';

export const UNLISTED_FILES = 'files unknown: recorded before file lists';

/** A ready or done part whose design or app files moved since its marks, with the changed paths of each side. */
export type StalePart = { part: string; design: string[]; app: string[] };

const changedSinceOf = (record: HashRecord, now: DesignHash) =>
  recordHolds(record, now) ? [] : record.files ? changedFilesOf(record.files, now.files) : [UNLISTED_FILES];

const partsOf = (product: ResolvedProduct, only?: string) =>
  product.parts.filter((part) => !only || partKeyOf(part) === only);

/**
 * The parts with a ready mark or an implemented record whose design hash moved since the ready mark or the go, or
 * whose app component files moved since the implemented record.
 */
export const stalePartsOf = (options: { product: ResolvedProduct; only?: string }): StalePart[] =>
  partsOf(options.product, options.only).flatMap((resolved) => {
    const { product } = options;
    const part = partKeyOf(resolved);
    const { dir } = partOwnerOf({ product, part: resolved });
    const ready = readReady(dir)[part];
    const go = readGo(dir)[part];
    const implemented = readImplemented(dir)[part];

    if (!ready && !implemented) return [];

    const now = designHashOf({ product, part: resolved });
    const design = [
      ...new Set([...(ready ? changedSinceOf(ready, now) : []), ...(implemented && go ? changedSinceOf(go, now) : [])]),
    ].sort((a, b) => a.localeCompare(b));
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

const rewrite = (file: string, entries: Record<string, unknown>) => {
  const sorted = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));

  writeFileSync(file, `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`);
};

const upgradeOf = (product: ResolvedProduct, resolved: ResolvedPart) => {
  const part = partKeyOf(resolved);
  const { dir } = partOwnerOf({ product, part: resolved });
  const go = readGo(dir);
  const ready = readReady(dir);
  const implemented = readImplemented(dir);
  const legacy = (record: HashRecord | undefined) => !!record && !record.files;

  if (!legacy(go[part]) && !legacy(ready[part]) && !(implemented[part] && !implemented[part]?.app)) return [];

  const now = designHashOf({ product, part: resolved });
  const holds = (record: HashRecord | undefined): record is HashRecord => legacy(record) && record?.hash === now.legacy;
  const upgraded: string[] = [];
  const goEntry = go[part];
  const readyEntry = ready[part];
  const implementedEntry = implemented[part];

  if (holds(goEntry)) {
    rewrite(resolve(dir, GO_FILE), { ...go, [part]: { ...goEntry, hash: now.hash, files: now.files } });
    upgraded.push('go');
  }
  if (holds(readyEntry)) {
    rewrite(resolve(dir, READY_FILE), { ...ready, [part]: { ...readyEntry, hash: now.hash, files: now.files } });
    upgraded.push('ready');
  }

  const component = linkedComponentOf(resolved.source);

  if (implementedEntry && implementedEntry.hash === now.legacy && !implementedEntry.app && component !== null) {
    rewrite(resolve(dir, IMPLEMENTED_FILE), {
      ...implemented,
      [part]: { ...implementedEntry, hash: now.hash, app: appFilesOf({ root: repoRootOf(product), component }) },
    });
    upgraded.push('implemented');
  }

  return upgraded.length > 0 ? [{ part, marks: upgraded }] : [];
};

/**
 * Moves each go, ready mark and implemented record stored before file lists to the design hash, with the hash of each
 * file it covers, while its folder-only hash still holds; an implemented record also gets its app file hashes. A
 * record whose folder changed since stays as it is and reads as stale.
 */
export const upgradeLegacyMarksOf = (options: { product: ResolvedProduct; only?: string }) =>
  partsOf(options.product, options.only).flatMap((part) => upgradeOf(options.product, part));
