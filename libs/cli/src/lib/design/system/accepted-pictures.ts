import { existsSync, readFileSync } from 'fs';
import { writeJsonFile } from '../../json-file';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter } from '../shot';
import { createDrawQueue } from '../thumb';
import { compareFrameOf } from './compare-command';
import { designHashOf, sha16 } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { openEditSketch } from './sketch/edit-sketch';
import { changedOutsideSketchOf, readMerged, recordMerged } from './sketch/merged-parts';
import { createSystemModules, productModuleIdOf } from './system-modules';
import { drawnStateNamesOf } from './unchanged-rows';

export const PICTURES_FILE = 'pictures.json';

/** The sha16 of each state's picture, under the state name. */
export type StatePictures = Record<string, string>;

/**
 * The pictures of a part's states at a hash. Pictures without `slots` were drawn with slots emptied and cannot prove
 * that slot content is unchanged, so they are read as missing.
 */
export type AcceptedPictures = { hash: string; states: StatePictures; slots: true };

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
}) => Promise<Map<string, StatePictures | string>>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const picturesFileOf = (dir: string) => resolve(dir, PICTURES_FILE);

const isAccepted = (value: unknown): value is AcceptedPictures => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, states, slots } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
    slots === true &&
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

export const drawStatePictures: DrawStates = async ({ target, config, product, parts, expected }) => {
  const drawn = new Map<string, StatePictures | string>();

  if (parts.length === 0) return drawn;

  if (!(await chromiumOf(target))) {
    for (const part of parts) drawn.set(part, 'drawing needs playwright or playwright-core in the checkout');

    return drawn;
  }

  const queue = createDrawQueue({ target });
  const server = await createDesignServer({ target, config, listen: true, port: 0 });
  let shooter: ReturnType<typeof createPartShooter> | undefined;

  try {
    await server.listen();

    const { port } = server.httpServer?.address() as AddressInfo;
    const pictures = createPartShooter({
      target,
      base: `http://localhost:${port}`,
      system: createSystemModules({ target, config }),
      queue,
    });

    shooter = pictures;

    for (const part of parts) {
      try {
        const frame = compareFrameOf({ presets: product.presets, part, preset: null });

        if (typeof frame === 'string') {
          drawn.set(part, frame);
          continue;
        }

        const file = product.parts.find((candidate) => partKeyOf(candidate) === part)?.file;

        if (!file) {
          drawn.set(part, `product "${product.name}" has no part "${part}"`);
          continue;
        }

        const module = (await server.ssrLoadModule(productModuleIdOf({ file, product: product.name }))) as {
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
                sketch: null,
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
  } catch (error) {
    for (const part of parts) if (!drawn.has(part)) drawn.set(part, messageOf(error));
  } finally {
    await shooter?.close();
    await queue.close();
    await server.close();
  }

  return drawn;
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
  const now = kind === 'review' ? partHashOf({ product, dir: dirname(resolved.file) }) : design;

  if (drawn === undefined || typeof drawn === 'string') return drawn ?? `${part} was not drawn`;
  if (now !== hash || designHashOf({ product, part: resolved }).hash !== design)
    return `${part} changed while it was drawn`;

  writePictures({ dir: partOwnerOf({ product, part: resolved }).dir, part, pictures: { hash: design, states: drawn } });

  return null;
};

export const newStatesLineOf = ({ product, part, states }: { product: string; part: string; states: string[] }) =>
  `NEW STATES ${product} ${part}: ${states.join(', ')} - for Tom's next review`;

/** The pictures a direct edit of the part is compared with: its `record`, else `review` at the merged hash, else `go`. */
const baselineOf = (pictures: PartPictures, merged: string | undefined) =>
  pictures.record ??
  (pictures.review && pictures.review.hash === merged ? pictures.review : null) ??
  pictures.go ??
  null;

type Need = { part: ResolvedPart; design: string; baseline: AcceptedPictures | null };

/**
 * The work of `design check` on the pictures of each merged part, or of `parts`: draws the `record` pictures of a part
 * unchanged since its merge when none are stored at its design hash, and resolves a direct edit of a part changed
 * outside a sketch. A direct edit that draws every state as before holds at once (its new hash goes to `merged.json`);
 * one that draws a state differently, or has no pictures to compare with, opens the old/new edit sketch. Answers with
 * one line per part it drew or decided.
 */
export const autoAcceptOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  only?: string;
  parts?: string[];
  draw?: DrawStates;
}): Promise<string[]> => {
  const { target, config, product, only } = options;
  const edited = new Set(changedOutsideSketchOf(product));
  const merged = readMerged(product.dir);
  const records: Need[] = [];
  const edits: Need[] = [];
  const lines: string[] = [];
  const opened = (part: string) => {
    const sketch = openEditSketch({ target, product, part, author: 'design check' });

    lines.push(
      typeof sketch === 'string'
        ? `DIRECT EDIT ${product.name} ${part}: changed outside a sketch, no old/new sketch: ${sketch}`
        : `DIRECT EDIT ${product.name} ${part}: changed outside a sketch - pick old or new in sketch ${sketch.target}`,
    );
  };

  for (const resolved of product.parts) {
    const part = partKeyOf(resolved);

    if ((only && part !== only) || (options.parts && !options.parts.includes(part))) continue;
    if (resolved.origin === 'base' || merged[part] === undefined) continue;

    const pictures = readPictures(partOwnerOf({ product, part: resolved }).dir)[part] ?? {};
    const design = designHashOf({ product, part: resolved }).hash;

    if (edited.has(part)) {
      const baseline = baselineOf(pictures, merged[part]);

      if (baseline) edits.push({ part: resolved, design, baseline });
      else opened(part);
    } else if (pictures.record?.hash !== design) records.push({ part: resolved, design, baseline: null });
  }

  const needs = [...edits, ...records];

  if (needs.length === 0) return lines;

  const drawn = await (options.draw ?? drawStatePictures)({
    target,
    config,
    product,
    parts: needs.map(({ part }) => partKeyOf(part)),
    expected: Object.fromEntries(
      edits.flatMap(({ part, baseline }) => (baseline ? [[partKeyOf(part), baseline.states]] : [])),
    ),
  });

  for (const { part: resolved, design, baseline } of needs) {
    const part = partKeyOf(resolved);
    const states = drawn.get(part);

    if (states === undefined || typeof states === 'string') {
      lines.push(`PICTURES NOT DRAWN ${product.name} ${part}: ${states ?? 'no drawing'}`);
      continue;
    }

    if (designHashOf({ product, part: resolved }).hash !== design) {
      lines.push(`PICTURES NOT DRAWN ${product.name} ${part}: changed while it was drawn`);
      continue;
    }

    const changed = baseline ? changedStatesOf(baseline.states, states) : [];

    if (baseline && changed.length > 0) {
      lines.push(`PICTURES CHANGED ${product.name} ${part}: ${changed.join(', ')}`);
      opened(part);
      continue;
    }

    if (baseline) {
      recordMerged({ product, parts: [part] });
      lines.push(`HELD ${product.name} ${part}: changed outside a sketch, every state draws as before`);
    }

    writePictures({ dir: partOwnerOf({ product, part: resolved }).dir, part, pictures: { hash: design, states } });
  }

  return lines;
};
