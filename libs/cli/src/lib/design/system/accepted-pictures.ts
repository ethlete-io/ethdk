import { existsSync, readFileSync } from 'fs';
import { writeJsonFile } from '../../json-file';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createPartShooter } from '../shot';
import { yieldRun } from '../run-yield';
import { DesignServer, drawingOn, WarmDraw } from '../warm-draw';
import { compareFrameOf } from './harness-shot';
import { designHashOf, sha16 } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { createPartPictureCache, PartPictureCache } from './part-picture-cache';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { EDIT_OLD, EditOldNotFound, openEditSketch, refreshEditOld, rewordEditNotes } from './sketch/edit-sketch';
import { discardSketch } from './sketch/merge';
import { changedOutsideSketchOf, EDIT_SKETCH, readMerged, recordMerged } from './sketch/merged-parts';
import { listSketches, Sketch } from './sketch/sketch';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system-modules';
import { drawnStateNamesOf } from './unchanged-rows';

export const PICTURES_FILE = 'pictures.json';

/** The sha16 of each state's picture, under the state name. */
export type StatePictures = Record<string, string>;

/**
 * The pictures of a part's states at a hash, and `partHash`, the part hash `merged.json` keeps, they were drawn at.
 * Pictures without `slots` were drawn with slots emptied and cannot prove that slot content is unchanged, so they are
 * read as missing.
 */
export type AcceptedPictures = { hash: string; states: StatePictures; slots: true; partHash?: string };

/**
 * `record` is drawn at the part's design hash while it is merged and unchanged since. `review` (at the merged hash)
 * and `go` (at the go's design hash) are older kinds, still read.
 */
export type PictureKind = 'record' | 'review' | 'go';

export type PartPictures = Partial<Record<PictureKind, AcceptedPictures>>;

/**
 * Draws every state of each part as `design compare` draws its design side, and answers per part with the picture
 * hash of each state or why it could not be drawn. A state that differs from `expected` is drawn once more, fresh.
 */
export type DrawStates = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts: string[];
  expected?: Record<string, StatePictures>;
  sketch?: SketchVariant;
  warm?: WarmDraw;
}) => Promise<Map<string, StatePictures | string>>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const picturesFileOf = (dir: string) => resolve(dir, PICTURES_FILE);

const isAccepted = (value: unknown): value is AcceptedPictures => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, states, slots, partHash } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
    slots === true &&
    (partHash === undefined || typeof partHash === 'string') &&
    !!states &&
    typeof states === 'object' &&
    !Array.isArray(states) &&
    Object.values(states).every((picture) => typeof picture === 'string')
  );
};

const KINDS: PictureKind[] = ['record', 'review', 'go'];

export const readPictures = (dir: string): Record<string, PartPictures> => {
  const file = picturesFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([part, entry]) => {
        const kinds = (entry ?? {}) as Record<string, unknown>;

        return [
          part,
          Object.fromEntries(KINDS.flatMap((kind) => (isAccepted(kinds[kind]) ? [[kind, kinds[kind]]] : []))),
        ];
      }),
    );
  } catch {
    return {};
  }
};

/** Writes the `record` pictures of one part into the pictures.json in `dir`, dropping its older kinds, sorted by part. */
export const writePictures = (options: { dir: string; part: string; pictures: Omit<AcceptedPictures, 'slots'> }) => {
  const { dir, part, pictures } = options;
  const all = readPictures(dir);
  const entries = Object.entries({ ...all, [part]: { record: { ...pictures, slots: true } } }).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  writeJsonFile({ file: picturesFileOf(dir), value: Object.fromEntries(entries) });
};

/** The states whose picture differs between two drawings, added and removed states included, sorted. */
export const changedStatesOf = (before: StatePictures, now: StatePictures) =>
  [...new Set([...Object.keys(before), ...Object.keys(now)])]
    .filter((state) => before[state] !== now[state])
    .sort((a, b) => a.localeCompare(b));

export const drawStatePictures: DrawStates = async ({ target, config, product, parts, expected, sketch, warm }) => {
  const drawn = new Map<string, StatePictures | string>();

  if (parts.length === 0) return drawn;

  if (!(await chromiumOf(target))) {
    for (const part of parts) drawn.set(part, 'drawing needs playwright or playwright-core in the checkout');

    return drawn;
  }

  try {
    await drawingOn({ target, config, warm }, async ({ server, base, queue }) => {
      const system = createSystemModules({ target, config });
      const pictures = createPartShooter({ target, base, system, queue });

      try {
        await drawPartsWith({ server, system, pictures, product, parts, expected, sketch, drawn });
      } finally {
        if (!warm) await pictures.close();
      }
    });
  } catch (error) {
    for (const part of parts) if (!drawn.has(part)) drawn.set(part, messageOf(error));
  }

  return drawn;
};

const drawPartsWith = async (options: {
  server: DesignServer;
  system: ReturnType<typeof createSystemModules>;
  pictures: ReturnType<typeof createPartShooter>;
  product: ResolvedProduct;
  parts: string[];
  expected?: Record<string, StatePictures>;
  sketch?: SketchVariant;
  drawn: Map<string, StatePictures | string>;
}) => {
  const { server, system, pictures, product, parts, expected, sketch, drawn } = options;

  for (const part of parts) {
    await yieldRun();

    try {
      const frame = compareFrameOf({ presets: product.presets, part, preset: null });

      if (typeof frame === 'string') {
        drawn.set(part, frame);
        continue;
      }

      const file = sketch
        ? system.partOf({ product: product.name, part, sketch })?.file
        : product.parts.find((candidate) => partKeyOf(candidate) === part)?.file;

      if (!file) {
        drawn.set(part, `product "${product.name}" has no part "${part}"`);
        continue;
      }

      const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name, sketch }))) as {
        default?: { states?: unknown };
      };
      const states = await drawnStateNamesOf(module.default);
      const pictureOf = async (state: string, fresh: boolean) =>
        sha16(
          (
            await pictures.pictureOf({
              product: product.name,
              part,
              state,
              preset: frame.preset,
              width: null,
              sketch: sketch ?? null,
              interaction: null,
              bare: true,
              emptySlots: false,
              checker: true,
              params: new URLSearchParams(),
              fresh,
            })
          ).png,
        );
      if (states.length === 0) {
        drawn.set(part, `${part} has no states`);
        continue;
      }

      const hashes: StatePictures = {};

      for (const state of states) {
        const first = await pictureOf(state, false);
        const want = expected?.[part]?.[state];

        hashes[state] = want !== undefined && want !== first ? await pictureOf(state, true) : first;
      }

      drawn.set(part, hashes);
    } catch (error) {
      drawn.set(part, messageOf(error));
    }
  }
};

/**
 * Draws a part and stores its `record` pictures at its design hash, after a go or an acceptance verified `hash` (of
 * `kind`). Answers with why nothing was stored, or `null`; `design check` draws the pictures later when they are missing.
 */
export const storePictures = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  kind: 'review' | 'go';
  hash: string;
  draw?: DrawStates;
}) => {
  const { target, config, product, part, kind, hash } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;

  const design = designHashOf({ product, part: resolved }).hash;
  const drawn = (await (options.draw ?? drawStatePictures)({ target, config, product, parts: [part] })).get(part);
  const partHash = partHashOf({ product, dir: dirname(resolved.file) });
  const now = kind === 'review' ? partHash : design;

  if (drawn === undefined || typeof drawn === 'string') return drawn ?? `${part} was not drawn`;
  if (now !== hash || designHashOf({ product, part: resolved }).hash !== design)
    return `${part} changed while it was drawn`;

  writePictures({
    dir: partOwnerOf({ product, part: resolved }).dir,
    part,
    pictures: { hash: design, states: drawn, partHash },
  });

  return null;
};

export const newStatesLineOf = ({ product, part, states }: { product: string; part: string; states: string[] }) =>
  `NEW STATES ${product} ${part}: ${states.join(', ')} - for Tom's next review`;

/**
 * The pictures a direct edit of the part is compared with: its `record` or `review` drawn at the merged part hash. A
 * `go` carries only a design hash, which cannot show that it was drawn at the merged part hash.
 */
const baselineOf = (pictures: PartPictures, merged: string | undefined) =>
  (merged !== undefined && pictures.record?.partHash === merged ? pictures.record : undefined) ??
  (merged !== undefined && pictures.review?.hash === merged ? pictures.review : undefined) ??
  null;

const isUndecidedEditSketch = (sketch: Sketch) =>
  sketch.target === `${partKeyOf(sketch)}@${EDIT_SKETCH}` &&
  sketch.status === 'ready' &&
  !sketch.decision &&
  !sketch.hold &&
  Object.values(sketch.rejections ?? {}).every((rejections) => rejections.length === 0);

type Need = { part: ResolvedPart; design: string; baseline: AcceptedPictures | null; sketch?: Sketch };

/**
 * The work of `design check` on the pictures of each merged part, or of `parts`: draws the `record` pictures of a part
 * unchanged since its merge when none are stored at its design hash, and resolves a direct edit of a part changed
 * outside a sketch, and of a part whose old/new edit sketch is open without a decision. A direct edit is compared with
 * its pictures at the merged hash, else with the `old` variant of the old/new edit sketch, which holds the part at the
 * newest commit with its merged hash (an open sketch's `old` is rewritten from that commit first). One that draws every
 * state as before holds at once (its new hash goes to `merged.json`, and the edit sketch closes); one that draws a state
 * differently leaves the edit sketch open. An `old` that does not draw, or no commit with the merged hash, goes to
 * `problems`, else to the lines.
 * Answers with one line per part it drew or decided.
 */
export const autoAcceptOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  only?: string;
  parts?: string[];
  draw?: DrawStates;
  problems?: Problem[];
  warm?: WarmDraw;
  cache?: PartPictureCache;
}): Promise<string[]> => {
  const { target, config, product, only, warm } = options;
  const cache = options.cache ?? createPartPictureCache({ target, product });
  const cachedOf = (resolved: ResolvedPart, hash: string | undefined): AcceptedPictures | null => {
    const states = hash === undefined ? null : cache.read(resolved, hash);

    return states && hash !== undefined ? { hash, states, slots: true } : null;
  };
  const partHashNowOf = (resolved: ResolvedPart) => partHashOf({ product, dir: dirname(resolved.file) });
  const edited = new Set(changedOutsideSketchOf(product));
  const editSketches = new Map(
    listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch !== 'string' && isUndecidedEditSketch(sketch) ? [[partKeyOf(sketch), sketch] as const] : [],
    ),
  );
  const merged = readMerged(product.dir);
  const records: Need[] = [];
  const edits: Need[] = [];
  const lines: string[] = [];
  const draw = options.draw ?? drawStatePictures;
  const heads: { part: ResolvedPart; design: string; sketch: Sketch; recheck?: true }[] = [];
  const problem = (resolved: ResolvedPart, { rule, message }: { rule: string; message: string }) => {
    if (options.problems) options.problems.push({ rule, file: resolved.file, message });
    else lines.push(`${rule} ${product.name} ${partKeyOf(resolved)}: ${message}`);
  };
  const oldNotDrawn = ({ resolved, sketch }: { resolved: ResolvedPart; sketch: Sketch }, why: string) =>
    problem(resolved, {
      rule: 'EDIT-OLD-NOT-DRAWN',
      message: `variant ${EDIT_OLD} of ${sketch.target} (the part at its merged commit) does not draw: ${why}`,
    });
  const isNotFound = (result: object | string | null): result is EditOldNotFound =>
    typeof result === 'object' && result !== null && 'rule' in result;
  const opened = (part: string, sketch: Sketch | string) =>
    lines.push(
      typeof sketch === 'string'
        ? `DIRECT EDIT ${product.name} ${part}: changed outside a sketch, no old/new sketch: ${sketch}`
        : `DIRECT EDIT ${product.name} ${part}: changed outside a sketch - pick old or new in sketch ${sketch.target}`,
    );
  const open = (part: string) => openEditSketch({ target, product, part, author: 'design check' });

  for (const resolved of product.parts) {
    const part = partKeyOf(resolved);

    if ((only && part !== only) || (options.parts && !options.parts.includes(part))) continue;
    if (resolved.origin === 'base' || merged[part] === undefined) continue;

    const pictures = readPictures(partOwnerOf({ product, part: resolved }).dir)[part] ?? {};
    const design = designHashOf({ product, part: resolved }).hash;
    const editSketch = editSketches.get(part);

    if (edited.has(part)) {
      const baseline = baselineOf(pictures, merged[part]) ?? cachedOf(resolved, merged[part]);

      if (baseline) {
        edits.push({ part: resolved, design, baseline });
        continue;
      }

      const sketch = open(part);

      if (isNotFound(sketch)) problem(resolved, sketch);
      else if (typeof sketch === 'string') opened(part, sketch);
      else heads.push({ part: resolved, design, sketch });
    } else if (editSketch) {
      const old = cachedOf(resolved, merged[part]);

      if (old) {
        rewordEditNotes(editSketch);
        edits.push({ part: resolved, design, baseline: old, sketch: editSketch });
      } else heads.push({ part: resolved, design, sketch: editSketch, recheck: true });
    } else if (pictures.record?.hash !== design) records.push({ part: resolved, design, baseline: null });
  }

  for (const { part: resolved, design, sketch, recheck } of heads) {
    const part = partKeyOf(resolved);
    const unreadable = recheck ? refreshEditOld({ product, sketch }) : null;

    if (isNotFound(unreadable)) {
      problem(resolved, unreadable);
      continue;
    }

    if (unreadable) {
      oldNotDrawn({ resolved, sketch }, unreadable);
      continue;
    }

    const old = (
      await draw({ target, config, product, parts: [part], sketch: { target: sketch.target, variant: EDIT_OLD }, warm })
    ).get(part);

    if (old === undefined || typeof old === 'string') oldNotDrawn({ resolved, sketch }, old ?? 'no drawing');
    else {
      if (merged[part] !== undefined) cache.write({ part: resolved, partHash: merged[part], states: old });
      edits.push({ part: resolved, design, baseline: { hash: merged[part] ?? '', states: old, slots: true }, sketch });
    }
  }

  const needs = [...edits, ...records];

  if (needs.length === 0) return lines;

  const cached = new Map(
    needs.flatMap(({ part }) => {
      const states = cache.read(part, partHashNowOf(part));

      return states ? [[partKeyOf(part), states] as const] : [];
    }),
  );
  const toDraw = needs.filter(({ part }) => !cached.has(partKeyOf(part)));
  const drawn = new Map<string, StatePictures | string>([
    ...cached,
    ...(toDraw.length === 0
      ? []
      : await draw({
          target,
          config,
          product,
          warm,
          parts: toDraw.map(({ part }) => partKeyOf(part)),
          expected: Object.fromEntries(
            edits.flatMap(({ part, baseline }) => (baseline ? [[partKeyOf(part), baseline.states]] : [])),
          ),
        })),
  ]);

  for (const { part: resolved, design, baseline, sketch } of needs) {
    const part = partKeyOf(resolved);
    const states = drawn.get(part);
    const notDrawn = (why: string) => {
      lines.push(`PICTURES NOT DRAWN ${product.name} ${part}: ${why}`);
      if (sketch) opened(part, sketch);
    };

    if (states === undefined || typeof states === 'string') {
      notDrawn(states ?? 'no drawing');
      continue;
    }

    if (designHashOf({ product, part: resolved }).hash !== design) {
      notDrawn('changed while it was drawn');
      continue;
    }

    if (!cached.has(part)) cache.write({ part: resolved, partHash: partHashNowOf(resolved), states });

    const changed = baseline ? changedStatesOf(baseline.states, states) : [];

    if (baseline && changed.length > 0) {
      lines.push(`PICTURES CHANGED ${product.name} ${part}: ${changed.join(', ')}`);
      const editSketch = sketch ?? open(part);

      if (isNotFound(editSketch)) problem(resolved, editSketch);
      else opened(part, editSketch);
      continue;
    }

    if (sketch) discardSketch({ target, sketch, author: 'design check' });

    if (baseline) {
      recordMerged({ product, parts: [part] });
      lines.push(`HELD ${product.name} ${part}: changed outside a sketch, every state draws as before`);
    }

    writePictures({
      dir: partOwnerOf({ product, part: resolved }).dir,
      part,
      pictures: { hash: design, states, partHash: partHashNowOf(resolved) },
    });
  }

  return lines;
};
