import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { writeJsonFile } from '../../json-file';
import { DesignConfig } from '../design-config';
import { Blocker } from './build-ready-contract';
import { designHashOf, FileHashes, isOptionalFileHashes, recordHolds } from './design-hash';
import { drawnFindingsOf } from './drawn-open-points';
import { actionsRerunReasonOf, changedEmbeddedOf, EmbeddedHashes, embeddedHashesOf } from './embedded-actions';
import { partOwnerOf } from './inventory-approval';
import { OpenPoint } from './open-points';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { partKeyOf, ResolvedProduct } from './resolve-product';
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

export const readReady = (dir: string): Record<string, PartReady> => {
  const file = readyFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, PartReady] => isReady(entry[1])))
      : {};
  } catch {
    return {};
  }
};

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

const writeReady = (dir: string, records: Record<string, PartReady>) =>
  writeJsonFile({
    file: readyFileOf(dir),
    value: Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b))),
  });

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

  const existing = readReady(found.dir);
  const previous = existing[options.part];
  const embedded = embeddedHashesOf({ product: options.product, part: found.resolved });
  const actions = options.actions ?? previous?.actions;
  const record: PartReady = {
    hash: found.hash,
    files: found.design.files,
    ...(Object.keys(embedded).length > 0 ? { embedded } : {}),
    ...(actions ? { actions } : {}),
    at: (previous?.hash === found.hash ? previous.at : undefined) ?? options.at ?? new Date().toISOString(),
    by: options.origin.by,
    cmd: options.origin.cmd,
    pid: options.origin.pid,
  };

  writeReady(found.dir, { ...existing, [options.part]: record });

  return record;
};

/** Drops the check record of a part, whatever hash it holds; true when there was one. */
export const dropPartRecord = (options: { product: ResolvedProduct; part: string }) => {
  const found = readyPartOf(options);

  if (typeof found === 'string') return false;

  const existing = readReady(found.dir);

  if (!(options.part in existing)) return false;

  writeReady(found.dir, Object.fromEntries(Object.entries(existing).filter(([key]) => key !== options.part)));

  return true;
};

/**
 * Checks a part at `hash` and writes its check record, or answers why not: 400 without `hash` or without an
 * `origin` that names its actor, 404 for an unknown
 * part, 409 when the part changed since `hash`, 422 while `pointsOf` lists any open point, `blockersOf` any other
 * blocker or `actionsOf` any failed action check. The failed-actions refusal names the embedded parts whose app files
 * changed since the last record. `pointsOf` runs only after the hash holds, `blockersOf` only after the open-point list
 * is empty, `actionsOf` only after the blocker list is. The record holds the keys `declaredActionsOf` answers; when it
 * answers why it could not read them, the record keeps the ones it held.
 */
export const markPartReady = async (options: {
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
}): Promise<PartReady | ReadyRefusal> => {
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

  return (
    writePartRecord({
      product,
      part,
      origin: options.origin,
      at: options.at,
      ...(Array.isArray(declared) ? { actions: declared } : {}),
    }) ?? {
      status: 404,
      error: `unknown part ${part}`,
    }
  );
};
