import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DesignConfig } from '../design-config';
import { designHashOf, FileHashes, isOptionalFileHashes, recordHolds } from './design-hash';
import { drawnFindingsOf } from './drawn-open-points';
import { appHashOf, changedEmbeddedOf, EmbeddedHashes, embeddedHashesOf } from './embedded-actions';
import { partOwnerOf } from './inventory-approval';
import { partBuilderOf, PartBuilder } from './part-builder';
import { OpenPoint } from './open-points';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { withProductLock } from './product-lock';
import { readStampText, writeStampFile } from './stamp-files';
import { hasActor, WriteOrigin } from './write-origin';

export const READY_FILE = 'ready.json';

/**
 * The check record of a build-ready part: the design hash it was checked at, with the hash of each file it covers; it
 * holds only while the hash does. `app` and `embedded` hold the app hash of the part and of each embedded part its
 * actions ran against. `by`,
 * `cmd` and `pid` name the writer; records written before they were required lack them. `builder` says who builds the
 * part, with `builderReasons` for a developer part; records written before B250c lack both.
 */
export type PartReady = {
  hash: string;
  files?: FileHashes;
  app?: string;
  embedded?: EmbeddedHashes;
  actions?: string[];
  builder?: PartBuilder['builder'];
  builderReasons?: string[];
  at: string;
  by?: string;
  cmd?: string;
  pid?: number;
};

const readyFileOf = (dir: string) => resolve(dir, READY_FILE);

const isReady = (value: unknown): value is PartReady => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, by, cmd, pid, at, files, app, embedded, actions, builder, builderReasons } = value as Record<
    string,
    unknown
  >;

  return (
    typeof hash === 'string' &&
    (app === undefined || typeof app === 'string') &&
    (builder === undefined || builder === 'designer' || builder === 'developer') &&
    (builderReasons === undefined ||
      (Array.isArray(builderReasons) && builderReasons.every((reason) => typeof reason === 'string'))) &&
    (by === undefined || typeof by === 'string') &&
    (cmd === undefined || typeof cmd === 'string') &&
    (pid === undefined || typeof pid === 'number') &&
    typeof at === 'string' &&
    isOptionalFileHashes(files) &&
    isOptionalFileHashes(embedded) &&
    (actions === undefined || (Array.isArray(actions) && actions.every((key) => typeof key === 'string')))
  );
};

/** The action keys a dropped check record held, kept as the baseline ACTION-LOST compares against. */
export type ActionBaseline = { actions: string[]; at: string };

const isActionBaseline = (value: unknown): value is ActionBaseline => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, at, actions } = value as Record<string, unknown>;

  return (
    hash === undefined &&
    typeof at === 'string' &&
    Array.isArray(actions) &&
    actions.every((key) => typeof key === 'string')
  );
};

/** Every entry of a ready.json: the check records, and the action baselines of parts whose record was dropped. */
export const readReadyEntries = (dir: string): Record<string, PartReady | ActionBaseline> => {
  const text = readStampText(readyFileOf(dir));

  if (text === null) return {};

  try {
    const parsed: unknown = JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, PartReady | ActionBaseline] => isReady(entry[1]) || isActionBaseline(entry[1]),
          ),
        )
      : {};
  } catch {
    return {};
  }
};

/** The check records of a ready.json; an action baseline is no record. */
export const readReady = (dir: string): Record<string, PartReady> =>
  Object.fromEntries(
    Object.entries(readReadyEntries(dir)).filter((entry): entry is [string, PartReady] => isReady(entry[1])),
  );

/** The recorded action keys of each part in a ready.json, from its check record or its action baseline. */
export const readRecordedActions = (dir: string): Record<string, ActionBaseline> =>
  Object.fromEntries(
    Object.entries(readReadyEntries(dir)).flatMap(([part, entry]) =>
      entry.actions ? [[part, { actions: entry.actions, at: entry.at }]] : [],
    ),
  );

/** The design hash of a part and the directory whose ready.json holds it, or why the product has no such part. */
export const readyPartOf = (options: { product: ResolvedProduct; part: string }) => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!resolved) return `product "${options.product.name}" has no part "${options.part}"`;

  const owner = partOwnerOf({ product: options.product, part: resolved });

  const design = designHashOf({ product: options.product, part: resolved });

  return { dir: owner.dir, hash: design.hash, design, resolved };
};

/** The ready mark of a part while its hash still matches, `null` when it has none or the part changed since. */
export const readyMarkOf = (options: { product: ResolvedProduct; part: string }): PartReady | null => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return null;

  const mark = readReady(found.dir)[options.part];

  return mark && recordHolds(mark, found.design) ? mark : null;
};

/**
 * Whether the ready mark of `part` lacks the builder its design and component answer now, or names another one; a mark
 * without a writer is left to the legacy upgrade.
 */
export const builderChangedOf = (options: { product: ResolvedProduct; part: string }) => {
  const found = readyPartOf(options);
  const mark = readyMarkOf(options);

  if (typeof found === 'string' || mark?.by === undefined) return false;

  const builder = partBuilderOf({ product: options.product, part: found.resolved });
  const reasons = builder.builder === 'developer' ? builder.reasons : undefined;

  return mark.builder !== builder.builder || JSON.stringify(mark.builderReasons) !== JSON.stringify(reasons);
};

/**
 * The parts whose app files changed since the actions of `part` ran for its ready mark, `part` itself first, then its
 * embedded parts; `[]` while the mark does not hold. A mark that predates the app or embedded record checks no change
 * of that kind.
 */
export const actionsRerunOf = (options: { product: ResolvedProduct; part: string }): string[] => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return [];

  const mark = readReady(found.dir)[options.part];

  if (!mark || !recordHolds(mark, found.design)) return [];

  const product = options.product;
  const own = mark.app !== undefined && mark.app !== appHashOf({ product, part: found.resolved }) ? [options.part] : [];

  return [
    ...own,
    ...(mark.embedded ? changedEmbeddedOf(mark.embedded, embeddedHashesOf({ product, part: found.resolved })) : []),
  ];
};

/** Draws a part and answers its whole open-point list, or why it could not be drawn. */
export const drawnPartPointsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
}): Promise<OpenPoint[] | { unavailable: string }> => {
  const findings = await drawnFindingsOf({ ...options, parts: [options.part] });

  return 'unavailable' in findings ? findings : partPointsOf(readOpenPoints(options.product, findings), options.part);
};

/** The parts of a product whose ready mark still holds. */
export const readyPartsOf = (product: ResolvedProduct) =>
  product.parts.map(partKeyOf).filter((part) => readyMarkOf({ product, part }) !== null);

const sameRecord = (previous: PartReady, next: PartReady) => {
  const { pid: _previousPid, ...held } = previous;
  const { pid: _nextPid, ...written } = next;

  return JSON.stringify(held) === JSON.stringify(written);
};

const writeReady = (dir: string, records: Record<string, PartReady | ActionBaseline>) =>
  writeStampFile(readyFileOf(dir), Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b))));

/**
 * Writes the check record of a part at its current design hash, stamped with `origin`, with `actions` as the action
 * keys the part declares; without `actions` the record keeps the ones it held. A record already at that hash keeps its
 * `at`. Answers `null` for an unknown part or an `origin` without `by`.
 */
export const writePartRecord = (options: {
  product: ResolvedProduct;
  part: string;
  origin: WriteOrigin;
  actions?: string[];
  at?: string;
}): PartReady | null => {
  const found = readyPartOf(options);

  if (typeof found === 'string' || !hasActor(options.origin)) return null;

  return withProductLock(found.dir, () => writeRecordOf({ ...options, found }));
};

/** Rewrites the builder of the current ready mark of `part` and keeps who wrote the mark; `null` without a mark that has a writer. */
export const writePartBuilder = (options: { product: ResolvedProduct; part: string }): PartReady | null => {
  const mark = readyMarkOf(options);

  if (mark?.by === undefined || mark.cmd === undefined) return null;

  return writePartRecord({ ...options, origin: { by: mark.by, cmd: mark.cmd, pid: mark.pid ?? 0 } });
};

const writeRecordOf = (options: {
  product: ResolvedProduct;
  part: string;
  origin: WriteOrigin;
  actions?: string[];
  at?: string;
  found: Exclude<ReturnType<typeof readyPartOf>, string>;
}): PartReady => {
  const { found } = options;
  const existing = readReadyEntries(found.dir);
  const previous = existing[options.part];
  const embedded = embeddedHashesOf({ product: options.product, part: found.resolved });
  const app = appHashOf({ product: options.product, part: found.resolved });
  const actions = options.actions ?? previous?.actions;
  const builder = partBuilderOf({ product: options.product, part: found.resolved });
  const record: PartReady = {
    hash: found.hash,
    files: found.design.files,
    ...(app === null ? {} : { app }),
    ...(Object.keys(embedded).length > 0 ? { embedded } : {}),
    ...(actions ? { actions } : {}),
    builder: builder.builder,
    ...(builder.builder === 'developer' ? { builderReasons: builder.reasons } : {}),
    at:
      (previous && 'hash' in previous && previous.hash === found.hash ? previous.at : undefined) ??
      options.at ??
      new Date().toISOString(),
    by: options.origin.by,
    cmd: options.origin.cmd,
    pid: options.origin.pid,
  };

  if (previous && isReady(previous) && sameRecord(previous, record)) return previous;

  writeReady(found.dir, { ...existing, [options.part]: record });

  return record;
};

/**
 * Drops the check record of a part, whatever hash it holds; true when there was one. The action keys it held stay as
 * the part's action baseline until a record is written again.
 */
export const dropPartRecord = (options: { product: ResolvedProduct; part: string }) => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return false;

  return withProductLock(found.dir, () => dropRecordIn(found.dir, options.part));
};

const dropRecordIn = (dir: string, part: string) => {
  const existing = readReadyEntries(dir);
  const record = existing[part];

  if (!record || !isReady(record)) return false;

  const rest = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== part));

  writeReady(dir, record.actions ? { ...rest, [part]: { actions: record.actions, at: record.at } } : rest);

  return true;
};

/**
 * Drops each entry of the product's own ready.json, check record or action baseline, whose part the product no longer
 * has; answers the dropped part keys.
 */
export const dropRemovedPartEntries = (product: ResolvedProduct): string[] => {
  if (product.parts.length === 0) return [];

  const keys = new Set(product.parts.map(partKeyOf));

  return withProductLock(product.dir, () => {
    const existing = readReadyEntries(product.dir);
    const removed = Object.keys(existing).filter((part) => !keys.has(part));

    if (removed.length > 0)
      writeReady(product.dir, Object.fromEntries(Object.entries(existing).filter(([part]) => keys.has(part))));

    return removed;
  });
};

/**
 * Drops from the recorded actions of each of `parts` the keys none of its design files names any more, as the merge
 * that removed them confirms; an action baseline left without keys goes.
 */
export const forgetUnnamedActions = (options: { product: ResolvedProduct; parts: string[] }) => {
  for (const part of options.parts) {
    const found = readyPartOf({ product: options.product, part });

    if (typeof found === 'string') continue;

    withProductLock(found.dir, () => {
      const existing = readReadyEntries(found.dir);
      const entry = existing[part];

      if (!entry?.actions?.length) return;

      const root = repoRootOf(options.product);
      const text = Object.keys(found.design.files)
        .map((file) => readFileSync(resolve(root, file), 'utf8'))
        .join('\n');
      const actions = entry.actions.filter((key) => text.includes(key));

      if (actions.length === entry.actions.length) return;

      const rest = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== part));

      writeReady(found.dir, isReady(entry) || actions.length > 0 ? { ...rest, [part]: { ...entry, actions } } : rest);
    });
  }
};

/** Drops the ready.json entry of a part the product no longer has; the others stay. */
export const dropEntryOfRemovedPart = (options: { product: ResolvedProduct; part: string }) => {
  const { product, part } = options;

  if (typeof readyPartOf({ product, part }) !== 'string' || product.parts.length === 0) return;

  withProductLock(product.dir, () => {
    const existing = readReadyEntries(product.dir);

    if (part in existing)
      writeReady(product.dir, Object.fromEntries(Object.entries(existing).filter(([key]) => key !== part)));
  });
};
