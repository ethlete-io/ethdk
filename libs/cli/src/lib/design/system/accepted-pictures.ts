import { existsSync, readFileSync } from 'fs';
import { writeJsonFile } from '../../json-file';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { pngSizeOf } from '../contact-sheet';
import { DesignConfig } from '../design-config';
import { createPartShooter } from '../shot';
import { withoutYield, yieldRun } from '../run-yield';
import { DesignServer, drawingOn, WarmDraw } from '../warm-draw';
import { commentsOnSketch } from './comments/comment';
import { compareFrameOf } from './harness-shot';
import { designHashOf, designHolds, sha16 } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { productCacheDirOf } from './product';
import { createPartPictureCache, PartPictureCache } from './part-picture-cache';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import {
  EDIT_OLD,
  isOpenOrPickedEditSketch,
  EditOldNotFound,
  editAwaitsPick,
  editOnlyRenamesOf,
  pickContradictsPart,
  pickedEditRemedyOf,
  headHoldsPart,
  isStaleEditSketch,
  openEditSketch,
  refreshEditOld,
  rewordEditNotes,
  tracksFileBelow,
  withHeadSnapshot,
} from './sketch/edit-sketch';
import { oldCommitOf } from './sketch/edit-old-base';
import { discardSketch } from './sketch/merge';
import { changedOutsideSketchOf, readMerged, recordMerged } from './sketch/merged-parts';
import { listSketches, Sketch } from './sketch/sketch';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system-modules';
import { themeTokenRenameOf } from './theme-token-renames';
import { drawnStateNamesOf } from './unchanged-rows';

export const PICTURES_FILE = 'pictures.json';

/** The sha16 of each state's picture, under the state name. */
export type StatePictures = Record<string, string>;

/** The size of each state's picture, fitted without the frame padding, under the state name. */
export type StateSizes = Record<string, { width: number; height: number }>;

/**
 * The pictures of a part's states at a hash, and `partHash`, the part hash `merged.json` keeps, they were drawn at, with
 * the size of each picture in `sizes`. Pictures without `slots` were drawn with slots emptied and cannot prove that slot
 * content is unchanged, so they are read as missing.
 */
export type AcceptedPictures = {
  hash: string;
  states: StatePictures;
  slots: true;
  partHash?: string;
  sizes?: StateSizes;
};

/** `record` is drawn at the part's design hash while it is merged and unchanged since. */
export type PartPictures = { record?: AcceptedPictures };

/**
 * Draws every state of each part as `design compare` draws its design side, and answers per part with the picture
 * hash of each state or why it could not be drawn. A state that differs from `expected` with a kept picture is drawn once more, fresh.
 * `sizes` gets the size of each drawn picture per part.
 */
export type DrawStates = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts: string[];
  expected?: Record<string, StatePictures | Promise<StatePictures | undefined>>;
  sketch?: SketchVariant;
  warm?: WarmDraw;
  sizes?: Map<string, StateSizes>;
}) => Promise<Map<string, StatePictures | string>>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const picturesFileOf = (dir: string) => resolve(productCacheDirOf(dir), PICTURES_FILE);

const committedPicturesFileOf = (dir: string) => resolve(dir, PICTURES_FILE);

const isSizes = (value: unknown): value is StateSizes =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (size: unknown) =>
      !!size &&
      typeof size === 'object' &&
      typeof (size as Record<string, unknown>)['width'] === 'number' &&
      typeof (size as Record<string, unknown>)['height'] === 'number',
  );

const isAccepted = (value: unknown): value is AcceptedPictures => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, states, slots, partHash, sizes } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
    (sizes === undefined || isSizes(sizes)) &&
    slots === true &&
    (partHash === undefined || typeof partHash === 'string') &&
    !!states &&
    typeof states === 'object' &&
    !Array.isArray(states) &&
    Object.values(states).every((picture) => typeof picture === 'string')
  );
};

const legacyRecordOf = (kinds: Record<string, unknown>): AcceptedPictures | undefined => {
  const { review, go } = kinds;

  if (isAccepted(review)) return { ...review, partHash: review.partHash ?? review.hash };

  return isAccepted(go) ? go : undefined;
};

const recordOf = (kinds: Record<string, unknown>): PartPictures => {
  const record = isAccepted(kinds['record']) ? kinds['record'] : legacyRecordOf(kinds);

  return record ? { record } : {};
};

/** The pictures in the product's cache, or in the pictures.json its folder held before the cache while no cache exists. */
export const readPictures = (dir: string): Record<string, PartPictures> => {
  const cached = picturesFileOf(dir);
  const file = existsSync(cached) ? cached : committedPicturesFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([part, entry]) => {
        const kinds = (entry ?? {}) as Record<string, unknown>;

        return [part, recordOf(kinds)];
      }),
    );
  } catch {
    return {};
  }
};

/** Writes the `record` pictures of one part into the product's cached pictures.json, dropping its older kinds, sorted by part. */
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

export const drawStatePictures: DrawStates = async ({
  target,
  config,
  product,
  parts,
  expected,
  sketch,
  warm,
  sizes,
}) => {
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
        await drawPartsWith({ server, system, pictures, product, parts, expected, sketch, drawn, sizes });
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
  expected?: Record<string, StatePictures | Promise<StatePictures | undefined>>;
  sketch?: SketchVariant;
  drawn: Map<string, StatePictures | string>;
  sizes?: Map<string, StateSizes>;
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

      const found = sketch
        ? system.partOf({ product: product.name, part, sketch })
        : product.parts.find((candidate) => partKeyOf(candidate) === part);
      const file = found?.file;

      if (!file) {
        drawn.set(part, `product "${product.name}" has no part "${part}"`);
        continue;
      }

      const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name, sketch }))) as {
        default?: { states?: unknown };
      };
      const states = await drawnStateNamesOf(module.default, found?.cssSource ?? null);
      const pictureOf = async (state: string, fresh: boolean) => {
        const { png, source } = await pictures.pictureOf({
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
        });

        return { hash: sha16(png), size: pngSizeOf(png), drawnNow: source === 'drawn' };
      };
      if (states.length === 0) {
        drawn.set(part, `${part} has no states`);
        continue;
      }

      const pictured = await Promise.all(
        states.map(async (state) => {
          const first = await pictureOf(state, false);

          if (first.drawnNow) return first;

          const want = (await expected?.[part])?.[state];

          return want !== undefined && want !== first.hash ? pictureOf(state, true) : first;
        }),
      );
      const hashes: StatePictures = {};
      const sized: StateSizes = {};

      states.forEach((state, at) => {
        const picture = pictured[at];

        if (!picture) return;

        hashes[state] = picture.hash;
        sized[state] = picture.size;
      });

      drawn.set(part, hashes);
      options.sizes?.set(part, sized);
    } catch (error) {
      drawn.set(part, messageOf(error));
    }
  }
};

/** The pictures a direct edit of the part is compared with: its `record` drawn at the merged part hash. */
const baselineOf = (pictures: PartPictures, merged: string | undefined) =>
  merged !== undefined && pictures.record?.partHash === merged ? pictures.record : null;

const isUndecidedEditSketch = (sketch: Sketch) => isOpenOrPickedEditSketch(sketch) && !sketch.decision;

type Need = { part: ResolvedPart; design: string; baseline: AcceptedPictures | null; sketch?: Sketch };

const editSketchesOf = (product: ResolvedProduct, matches: (sketch: Sketch) => boolean) =>
  new Map(
    listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch !== 'string' && matches(sketch) ? [[partKeyOf(sketch), sketch] as const] : [],
    ),
  );

const discardsUntracked = (product: ResolvedProduct, sketch: Sketch) =>
  !tracksFileBelow(product, sketch.dir) &&
  commentsOnSketch({ productDir: product.dir, product: product.name, sketch }).length === 0;

const leftStaleEditLinesOf = (product: ResolvedProduct, parts: string[] | undefined) =>
  withHeadSnapshot(() =>
    listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch !== 'string' &&
      (!parts || parts.includes(partKeyOf(sketch))) &&
      isStaleEditSketch(product, sketch) &&
      !editAwaitsPick(product, sketch)
        ? [
            pickContradictsPart(product, sketch)
              ? `STALE EDIT SKETCH ${product.name} ${sketch.target}: ${partKeyOf(sketch)} matches HEAD, but ${pickedEditRemedyOf(product, sketch)}`
              : `STALE EDIT SKETCH ${product.name} ${sketch.target}: ${partKeyOf(sketch)} matches HEAD - discard it: sketch discard ${sketch.target} --product ${product.name} --by <model id>`,
          ]
        : [],
    ),
  );

/**
 * Settles each direct edit of a merged part, or of `parts`, that HEAD already holds: records its hash in `merged.json`
 * and deletes its edit sketch, open or picked, unless the part contradicts its pick (`pickContradictsPart`) or the
 * sketch awaits a pick (`editAwaitsPick`). Answers the parts it settled. A hash only the stamp cache holds counts as unrecorded. With `writesTracked: false` it records
 * nothing and deletes only an edit sketch git does not track and no comment is on. `held` gets each settled part with
 * its part hash; `lines` gets a STALE EDIT SKETCH line per edit sketch whose part HEAD holds, deleted or left.
 */
export const settleCommittedEdits = (options: {
  target: string;
  product: ResolvedProduct;
  parts?: string[];
  writesTracked?: boolean;
  held?: { part: string; hash: string }[];
  lines?: string[];
}) => {
  const { target, product } = options;
  const writesTracked = options.writesTracked ?? true;
  const { sketches, settled } = withHeadSnapshot(() => {
    const sketches = editSketchesOf(product, isOpenOrPickedEditSketch);
    const kept = new Set(
      editSketchesOf(
        product,
        (sketch) => pickContradictsPart(product, sketch) || editAwaitsPick(product, sketch),
      ).keys(),
    );
    const candidates = new Set([...changedOutsideSketchOf(product, { tracked: writesTracked }), ...sketches.keys()]);
    const settled = product.parts.filter((resolved) => {
      const part = partKeyOf(resolved);

      return (
        candidates.has(part) &&
        !kept.has(part) &&
        resolved.origin !== 'base' &&
        (!options.parts || options.parts.includes(part)) &&
        headHoldsPart(product, resolved)
      );
    });

    return { sketches, settled };
  });

  for (const resolved of settled) {
    const part = partKeyOf(resolved);
    const sketch = sketches.get(part);

    if (sketch && (writesTracked || discardsUntracked(product, sketch))) {
      discardSketch({ target, sketch, author: 'design check' });
      options.lines?.push(`STALE EDIT SKETCH ${product.name} ${sketch.target}: ${part} matches HEAD - discarded`);
    }
  }

  if (options.lines) options.lines.push(...leftStaleEditLinesOf(product, options.parts));

  const parts = settled.map(partKeyOf);

  for (const resolved of settled)
    options.held?.push({ part: partKeyOf(resolved), hash: partHashOf({ product, dir: dirname(resolved.file) }) });

  if (writesTracked && parts.length > 0) recordMerged({ product, parts });

  return parts;
};

/**
 * The work of `design check` on the pictures of each merged part, or of `parts`: draws the `record` pictures of a part
 * unchanged since its merge when none are stored at its design hash, and resolves a direct edit of a part changed
 * outside a sketch, and of a part whose old/new edit sketch is open without a decision. A direct edit HEAD already
 * holds is settled first, as `settleCommittedEdits` does. Any other direct edit is compared with
 * its pictures at the merged hash, else with the `old` variant of the old/new edit sketch, which holds the part at HEAD
 * (an open sketch's `old` is rewritten from HEAD first). One that draws every
 * state as before holds at once (its new hash goes to `merged.json`, and the edit sketch closes); one that draws a state
 * differently leaves the edit sketch open. An `old` that does not draw, or a part HEAD does not hold, goes to
 * `problems`, else to the lines. With `writesTracked: false` (the design server) it writes no file git tracks: a held
 * or settled edit stays unrecorded. `held` gets each held or settled part with its part hash.
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
  writesTracked?: boolean;
  held?: { part: string; hash: string }[];
  opened?: string[];
}): Promise<string[]> => {
  const { target, config, product, only, warm } = options;
  const writesTracked = options.writesTracked ?? true;
  const cache = options.cache ?? createPartPictureCache({ target, product });
  const cachedOf = (resolved: ResolvedPart, hash: string | undefined): AcceptedPictures | null => {
    const states = hash === undefined ? null : cache.read(resolved, hash);

    return states && hash !== undefined ? { hash, states, slots: true } : null;
  };
  const partHashNowOf = (resolved: ResolvedPart) => partHashOf({ product, dir: dirname(resolved.file) });

  const lines: string[] = [];
  const settled = new Set(
    settleCommittedEdits({
      target,
      product,
      parts: only ? (options.parts ?? [only]).filter((part) => part === only) : options.parts,
      writesTracked,
      held: options.held,
      lines,
    }),
  );

  const edited = new Set(changedOutsideSketchOf(product));
  const editSketches = editSketchesOf(product, isUndecidedEditSketch);
  const merged = readMerged(product.dir);
  const records: Need[] = [];
  const edits: Need[] = [];
  const draw = options.draw ?? drawStatePictures;
  const heads: { part: ResolvedPart; design: string; sketch: Sketch; recheck?: true }[] = [];
  const problem = (resolved: ResolvedPart, { rule, message }: { rule: string; message: string }) => {
    if (options.problems) options.problems.push({ rule, file: resolved.file, message });
    else lines.push(`${rule} ${product.name} ${partKeyOf(resolved)}: ${message}`);
  };
  const oldNotDrawn = ({ resolved, sketch }: { resolved: ResolvedPart; sketch: Sketch }, why: string) =>
    problem(resolved, {
      rule: 'EDIT-OLD-NOT-DRAWN',
      message: `variant ${EDIT_OLD} of ${sketch.target} (the part at HEAD) does not draw: ${why}`,
    });
  const isNotFound = (result: object | string | null): result is EditOldNotFound =>
    typeof result === 'object' && result !== null && 'rule' in result;
  const opened = (part: string, sketch: Sketch | string) =>
    lines.push(
      typeof sketch === 'string'
        ? `DIRECT EDIT ${product.name} ${part}: changed outside a sketch, no old/new sketch: ${sketch}`
        : `DIRECT EDIT ${product.name} ${part}: changed outside a sketch - pick old or new in sketch ${sketch.target}`,
    );
  const openedNow = new Set<string>();
  const closeAsDrawnBefore = (sketch: Sketch) => {
    discardSketch({ target, sketch, author: 'design check' });

    if (!openedNow.has(sketch.target) || !options.opened) return;

    const prefix = `OPENED ${product.name} ${sketch.target}:`;
    const kept = options.opened.filter((line) => !line.startsWith(prefix));

    options.opened.splice(
      0,
      options.opened.length,
      ...kept,
      `CLOSED ${product.name} ${sketch.target}: draws as before`,
    );
  };
  const open = async (part: string) => {
    const result = await openEditSketch({ target, product, part, author: 'design check' });
    const sketch = typeof result === 'string' ? null : 'rule' in result ? result.sketch : result;

    if (sketch) {
      openedNow.add(sketch.target);
      options.opened?.push(`OPENED ${product.name} ${sketch.target}: direct edit of ${part} - pick old or new`);
    }

    return result;
  };

  let renamed: ((old: string, now: string) => boolean) | null | undefined;
  const renamesOnly = (resolved: ResolvedPart, commit: string) => {
    if (renamed === undefined) renamed = themeTokenRenameOf({ target, config });

    return renamed !== null && editOnlyRenamesOf({ product, resolved, renamed, commit });
  };
  const holdRename = (resolved: ResolvedPart, design: string) => {
    const part = partKeyOf(resolved);

    lines.push(`RENAMED ${product.name} ${part}: changed outside a sketch, only theme tokens renamed`);
    options.held?.push({ part, hash: partHashNowOf(resolved) });

    if (writesTracked) recordMerged({ product, parts: [part] });

    records.push({ part: resolved, design, baseline: null });
  };

  for (const resolved of product.parts) {
    const part = partKeyOf(resolved);

    if ((only && part !== only) || (options.parts && !options.parts.includes(part))) continue;
    if (resolved.origin === 'base' || merged[part] === undefined || (!writesTracked && settled.has(part))) continue;

    const pictures = readPictures(partOwnerOf({ product, part: resolved }).dir)[part] ?? {};
    const designHash = designHashOf({ product, part: resolved });
    const design = designHash.hash;
    const editSketch = editSketches.get(part);

    if (edited.has(part) && !editSketch && renamesOnly(resolved, 'HEAD')) {
      holdRename(resolved, design);
      continue;
    }

    if (edited.has(part)) {
      const baseline = baselineOf(pictures, merged[part]) ?? cachedOf(resolved, merged[part]);

      if (baseline) {
        edits.push({ part: resolved, design, baseline });
        continue;
      }

      const sketch = await open(part);

      if (isNotFound(sketch)) problem(resolved, sketch);
      else if (typeof sketch === 'string') opened(part, sketch);
      else heads.push({ part: resolved, design, sketch });
    } else if (editSketch) {
      if (!editSketch.variants.includes(EDIT_OLD)) continue;
      if (!writesTracked && tracksFileBelow(product, editSketch.dir)) continue;

      if (
        !editAwaitsPick(product, editSketch) &&
        (writesTracked || discardsUntracked(product, editSketch)) &&
        renamesOnly(resolved, oldCommitOf(repoRootOf(product), editSketch) ?? 'HEAD')
      ) {
        closeAsDrawnBefore(editSketch);
        holdRename(resolved, design);
        continue;
      }

      const old = cachedOf(resolved, merged[part]);

      if (old) {
        rewordEditNotes(editSketch);
        edits.push({ part: resolved, design, baseline: old, sketch: editSketch });
      } else heads.push({ part: resolved, design, sketch: editSketch, recheck: true });
    } else if (!pictures.record?.sizes || !designHolds(pictures.record.hash, designHash))
      records.push({ part: resolved, design, baseline: null });
  }

  const checked = heads.map((head) => ({
    ...head,
    unreadable: head.recheck ? refreshEditOld({ product, sketch: head.sketch }) : null,
  }));
  const drawable = checked.filter(({ unreadable }) => !unreadable);
  const settleHeads = (olds: (StatePictures | string | undefined)[]) => {
    for (const head of checked) {
      const { part: resolved, design, sketch, unreadable } = head;
      const old = olds[drawable.indexOf(head)];

      if (isNotFound(unreadable)) problem(resolved, unreadable);
      else if (unreadable) oldNotDrawn({ resolved, sketch }, unreadable);
      else if (old === undefined || typeof old === 'string') oldNotDrawn({ resolved, sketch }, old ?? 'no drawing');
      else
        edits.push({
          part: resolved,
          design,
          baseline: { hash: merged[partKeyOf(resolved)] ?? '', states: old, slots: true },
          sketch,
        });
    }
  };

  if (edits.length + drawable.length + records.length === 0) {
    settleHeads([]);

    return lines;
  }

  await yieldRun();

  const olds = withoutYield(() =>
    Promise.all(
      drawable.map(async ({ part: resolved, sketch }) => {
        const part = partKeyOf(resolved);
        const old = (
          await draw({
            target,
            config,
            product,
            parts: [part],
            sketch: { target: sketch.target, variant: EDIT_OLD },
            warm,
          })
        ).get(part);

        if (old !== undefined && typeof old !== 'string' && merged[part] !== undefined)
          cache.write({ part: resolved, partHash: merged[part], states: old });

        return old;
      }),
    ),
  );
  const oldOf = (resolved: ResolvedPart) =>
    olds.then(
      (drawn) => {
        const old = drawn[drawable.findIndex(({ part }) => part === resolved)];

        return old === undefined || typeof old === 'string' ? undefined : old;
      },
      () => undefined,
    );

  await Promise.all(
    drawable.filter(({ part }) => merged[partKeyOf(part)] === partHashNowOf(part)).map(({ part }) => oldOf(part)),
  );

  const sizes = new Map<string, StateSizes>();
  const keptNowOf = (part: ResolvedPart, compared: boolean) => {
    const states = cache.read(part, partHashNowOf(part));
    const sized = cache.sizesOf(part, partHashNowOf(part));

    if (!states || (!sized && !compared)) return [];

    if (sized) sizes.set(partKeyOf(part), sized);

    return [[partKeyOf(part), states] as const];
  };
  const cached = new Map([
    ...edits.flatMap(({ part, baseline }) => keptNowOf(part, !!baseline)),
    ...drawable.flatMap(({ part }) => keptNowOf(part, true)),
    ...records.flatMap(({ part, baseline }) => keptNowOf(part, !!baseline)),
  ]);
  const toDraw = [...edits, ...drawable, ...records].filter(({ part }) => !cached.has(partKeyOf(part)));
  const expected: Record<string, StatePictures | Promise<StatePictures | undefined>> = Object.fromEntries([
    ...edits.flatMap(({ part, baseline }) => (baseline ? [[partKeyOf(part), baseline.states]] : [])),
    ...drawable.map(({ part }) => [partKeyOf(part), oldOf(part)]),
  ]);
  const [drawnNow, oldsDrawn] = await Promise.all([
    toDraw.length === 0
      ? new Map<string, StatePictures | string>()
      : draw({ target, config, product, warm, sizes, parts: toDraw.map(({ part }) => partKeyOf(part)), expected }),
    olds,
  ]);

  settleHeads(oldsDrawn);

  const drawn = new Map<string, StatePictures | string>([...cached, ...drawnNow]);
  const needs = [...edits, ...records];

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

    if (!cached.has(part))
      cache.write({ part: resolved, partHash: partHashNowOf(resolved), states, sizes: sizes.get(part) });

    const changed = baseline ? changedStatesOf(baseline.states, states) : [];

    if (baseline && changed.length > 0) {
      lines.push(`PICTURES CHANGED ${product.name} ${part}: ${changed.join(', ')}`);
      const editSketch = sketch ?? (await open(part));

      if (isNotFound(editSketch)) problem(resolved, editSketch);
      else opened(part, editSketch);
      continue;
    }

    if (sketch && editAwaitsPick(product, sketch)) {
      opened(part, sketch);
      continue;
    }

    if (sketch && (writesTracked || discardsUntracked(product, sketch))) closeAsDrawnBefore(sketch);

    if (baseline) {
      lines.push(`HELD ${product.name} ${part}: changed outside a sketch, every state draws as before`);
      options.held?.push({ part, hash: partHashNowOf(resolved) });

      if (!writesTracked) continue;

      recordMerged({ product, parts: [part] });
    }

    writePictures({
      dir: partOwnerOf({ product, part: resolved }).dir,
      part,
      pictures: {
        hash: design,
        states,
        partHash: partHashNowOf(resolved),
        ...(sizes.has(part) ? { sizes: sizes.get(part) } : {}),
      },
    });
  }

  return lines;
};
