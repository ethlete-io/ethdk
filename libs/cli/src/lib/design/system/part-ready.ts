import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { writeJsonFile } from '../../json-file';
import { resolve } from 'path';
import { gitStatusOf } from '../git-reader';
import { DesignConfig } from '../design-config';
import { Blocker } from './build-ready-contract';
import { designHashOf, FileHashes, isOptionalFileHashes, recordHolds } from './design-hash';
import { drawnFindingsOf } from './drawn-open-points';
import { actionsRerunReasonOf, changedEmbeddedOf, EmbeddedHashes, embeddedHashesOf } from './embedded-actions';
import { partOwnerOf } from './inventory-approval';
import { OpenPoint } from './open-points';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { withProductLock } from './product-lock';
import { commitOwnFilesSync } from './sketch/merge-commit';
import { readStampText, writeStampFile } from './stamp-files';
import { hasActor, WriteOrigin } from './write-origin';

export const READY_FILE = 'ready.json';

/**
 * The check record of a build-ready part: the design hash it was checked at, with the hash of each file it covers; it
 * holds only while the hash does. `embedded` holds the app hash of each embedded part its actions ran against. `by`,
 * `cmd` and `pid` name the writer; records written before they were required lack them.
 */
export type PartReady = {
  hash: string;
  files?: FileHashes;
  embedded?: EmbeddedHashes;
  actions?: string[];
  at: string;
  by?: string;
  cmd?: string;
  pid?: number;
};

export type ReadyRefusal = {
  status: number;
  error: string;
  points?: OpenPoint[];
  actions?: string[];
  blockers?: Blocker[];
};

const readyFileOf = (dir: string) => resolve(dir, READY_FILE);

const isReady = (value: unknown): value is PartReady => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, by, cmd, pid, at, files, embedded, actions } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
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
 * The embedded parts whose app files changed since the actions of `part` ran for its ready mark, `[]` while the mark
 * does not hold or predates the embedded record.
 */
export const actionsRerunOf = (options: { product: ResolvedProduct; part: string }): string[] => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return [];

  const mark = readReady(found.dir)[options.part];

  if (!mark?.embedded || !recordHolds(mark, found.design)) return [];

  return changedEmbeddedOf(mark.embedded, embeddedHashesOf({ product: options.product, part: found.resolved }));
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
  const actions = options.actions ?? previous?.actions;
  const record: PartReady = {
    hash: found.hash,
    files: found.design.files,
    ...(Object.keys(embedded).length > 0 ? { embedded } : {}),
    ...(actions ? { actions } : {}),
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

const entriesOfText = (text: string | null): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = text === null ? undefined : JSON.parse(text);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const headEntriesOf = (dir: string) => {
  const shown = gitStatusOf(['show', `HEAD:./${READY_FILE}`], { cwd: dir, stdio: 'pipe' });

  return shown.status === 0 ? entriesOfText(shown.stdout) : undefined;
};

const headEntryOf = (dir: string, part: string): unknown => headEntriesOf(dir)?.[part];

const commitOwnEntry = (options: { target: string; dir: string; part: string; slug: string; subject: string }) =>
  withProductLock(options.dir, () => {
    const { target, dir, part, slug, subject } = options;
    const file = readyFileOf(dir);
    const original = existsSync(file) ? readFileSync(file, 'utf8') : null;
    const own = entriesOfText(original)?.[part];
    const composed = Object.entries({ ...headEntriesOf(dir), [part]: own })
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    writeJsonFile({ file, value: Object.fromEntries(composed) });

    try {
      return commitOwnFilesSync({ target, files: [file], slug, subject });
    } finally {
      if (original === null) rmSync(file, { force: true });
      else writeFileSync(file, original);
    }
  });

const commitDroppedEntry = (options: { target: string; product: ResolvedProduct; part: string }) => {
  const { product, part } = options;
  const found = readyPartOf({ product, part });
  const dir = typeof found === 'string' ? product.dir : found.dir;

  if (typeof found === 'string' && product.parts.length > 0)
    withProductLock(dir, () => {
      const existing = readReadyEntries(dir);

      if (part in existing)
        writeReady(dir, Object.fromEntries(Object.entries(existing).filter(([key]) => key !== part)));
    });

  const head = headEntryOf(dir, part);
  const now = readReadyEntries(dir)[part];

  if (head === undefined || isReady(now) || JSON.stringify(head) === JSON.stringify(now)) return;

  const refused = commitOwnEntry({
    target: options.target,
    dir,
    part,
    slug: `ready-drop-${part}`,
    subject: `chore(repo): Drop the ready record of ${part} in ${product.name}`,
  });

  if (refused !== null)
    console.warn(`READY UNCOMMITTED ${part}: the record is dropped, but the commit failed: ${refused}`);
};

/**
 * Checks a part at `hash` and writes its check record, or answers why not: 400 without `hash` or without an
 * `origin` that names its actor, 404 for an unknown
 * part, 409 when the part changed since `hash`, 422 while `pointsOf` lists any open point, `blockersOf` any other
 * blocker or `actionsOf` any failed action check. The failed-actions refusal names the embedded parts whose app files
 * changed since the last record. `pointsOf` runs only after the hash holds, `blockersOf` only after the open-point list
 * is empty, `actionsOf` only after the blocker list is. The record holds the keys `declaredActionsOf` answers; when it
 * answers why it could not read them, the record keeps the ones it held. With `commitIn`, it commits the ready.json
 * alone in that checkout and only warns when git refuses; on a refusal it commits the part's entry when it is no record
 * and differs from HEAD, after dropping it for a part the product no longer has.
 */
export const markPartReady = async (options: MarkOptions): Promise<PartReady | ReadyRefusal> => {
  const marked = await markOf(options);

  if ('status' in marked && options.commitIn && hasActor(options.origin))
    commitDroppedEntry({ target: options.commitIn, product: options.product, part: options.part });

  return marked;
};

type MarkOptions = {
  product: ResolvedProduct;
  part: string;
  hash: unknown;
  origin: WriteOrigin;
  pointsOf: () => Promise<OpenPoint[] | ReadyRefusal>;
  blockersOf?: () => Promise<Blocker[]>;
  actionsOf: () => Promise<string[] | ReadyRefusal>;
  declaredActionsOf?: () => Promise<string[] | string>;
  actionsNote?: string;
  at?: string;
  commitIn?: string;
};

const markOf = async (options: MarkOptions): Promise<PartReady | ReadyRefusal> => {
  const { product, part, hash } = options;

  if (!hasActor(options.origin)) return { status: 400, error: 'a ready mark needs the actor that writes it (by)' };
  if (typeof hash !== 'string' || hash === '') return { status: 400, error: 'hash is required' };

  const found = readyPartOf({ product, part });

  if (typeof found === 'string') return { status: 404, error: found };
  if (hash !== found.hash)
    return { status: 409, error: `${part} changed since its open points were shown - reload and check it again` };

  const points = await options.pointsOf();

  if (!Array.isArray(points)) return points;
  if (points.length > 0)
    return {
      status: 422,
      error: `${part} has ${points.length} open point${points.length === 1 ? '' : 's'} - close them before ready`,
      points,
    };

  const blockers = (await options.blockersOf?.()) ?? [];

  if (blockers.length > 0)
    return {
      status: 422,
      error: `${part} has ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} - fix them before ready`,
      blockers,
    };

  const rerun = actionsRerunOf({ product, part });
  const actions = await options.actionsOf();
  const notes = [
    ...(rerun.length > 0 ? [actionsRerunReasonOf(rerun)] : []),
    ...(options.actionsNote ? [options.actionsNote] : []),
  ];

  if (!Array.isArray(actions)) return actions;
  if (actions.length > 0)
    return {
      status: 422,
      error: `${part} fails ${actions.length} action check${actions.length === 1 ? '' : 's'} - fix them before ready${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`,
      actions,
    };

  const declared = await options.declaredActionsOf?.();

  const record = writePartRecord({
    product,
    part,
    origin: options.origin,
    at: options.at,
    ...(Array.isArray(declared) ? { actions: declared } : {}),
  });

  if (!record) return { status: 404, error: `unknown part ${part}` };
  if (options.commitIn) commitReadyFile({ target: options.commitIn, product, part, dir: found.dir });

  return record;
};

const commitReadyFile = (options: { target: string; product: ResolvedProduct; part: string; dir: string }) => {
  const refused = commitOwnEntry({
    target: options.target,
    dir: options.dir,
    part: options.part,
    slug: `ready-${options.part}`,
    subject: `feat(repo): Mark ${options.part} build-ready in ${options.product.name}`,
  });

  if (refused !== null)
    console.warn(`READY UNCOMMITTED ${options.part}: the mark is written, but the commit failed: ${refused}`);
};
