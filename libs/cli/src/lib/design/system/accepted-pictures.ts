import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AddressInfo } from 'net';
import { dirname, resolve } from 'path';
import { chromiumOf } from '../browser';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { createPartShooter } from '../shot';
import { createDrawQueue } from '../thumb';
import { compareFrameOf } from './compare-command';
import { designHashOf, recordHolds, sha16 } from './design-hash';
import { partOwnerOf } from './inventory-approval';
import { PartGo, readGo, writeGo } from './part-go';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { changedOutsideSketchOf, readAccepted, readMerged, recordAutoReview } from './sketch/merged-parts';
import { createSystemModules, productModuleIdOf } from './system-modules';

export const PICTURES_FILE = 'pictures.json';

/** The sha16 of each state's picture, under the state name. */
export type StatePictures = Record<string, string>;

/** The pictures of a part's states at the hash its review (`merged.json`) or its go held at. */
export type AcceptedPictures = { hash: string; states: StatePictures };

export type PictureKind = 'review' | 'go';

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

/** Who an automatic review or go is recorded for: the `by` of the acceptance or go it carries forward. */
export const autoAcceptBy = (previous: string | undefined) => previous ?? 'design check';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const picturesFileOf = (dir: string) => resolve(dir, PICTURES_FILE);

const isAccepted = (value: unknown): value is AcceptedPictures => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const { hash, states } = value as Record<string, unknown>;

  return (
    typeof hash === 'string' &&
    !!states &&
    typeof states === 'object' &&
    !Array.isArray(states) &&
    Object.values(states).every((picture) => typeof picture === 'string')
  );
};

export const readPictures = (dir: string): Record<string, PartPictures> => {
  const file = picturesFileOf(dir);

  if (!existsSync(file)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([part, entry]) => {
        const { review, go } = (entry ?? {}) as Record<string, unknown>;

        return [part, { ...(isAccepted(review) ? { review } : {}), ...(isAccepted(go) ? { go } : {}) }];
      }),
    );
  } catch {
    return {};
  }
};

/** Writes the pictures of one kind for one part into the pictures.json in `dir`, sorted by part. */
export const writePictures = (options: {
  dir: string;
  part: string;
  kind: PictureKind;
  pictures: AcceptedPictures;
}) => {
  const { dir, part, kind, pictures } = options;
  const all = readPictures(dir);
  const entries = Object.entries({ ...all, [part]: { ...all[part], [kind]: pictures } }).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  writeFileSync(picturesFileOf(dir), `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`);
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
        const loaded = module.default?.states;
        const states = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? Object.keys(loaded) : [];
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
                emptySlots: true,
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
 * Draws a part and stores its pictures of `kind` at `hash`, after a go or an acceptance. Answers with why nothing was
 * stored, or `null`; `design check` draws the pictures later when they are missing.
 */
export const storePictures = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  kind: PictureKind;
  hash: string;
  draw?: DrawStates;
}) => {
  const { target, config, product, part, kind, hash } = options;
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved) return `product "${product.name}" has no part "${part}"`;

  const drawn = (await (options.draw ?? drawStatePictures)({ target, config, product, parts: [part] })).get(part);

  if (drawn === undefined || typeof drawn === 'string') return drawn ?? `${part} was not drawn`;
  if (currentHashOf({ product, resolved, kind: kind }) !== hash) return `${part} changed while it was drawn`;

  writePictures({ dir: partOwnerOf({ product, part: resolved }).dir, part, kind, pictures: { hash, states: drawn } });

  return null;
};

type Need = { kind: PictureKind; hash: string; now: string; carry: AcceptedPictures | null };

const currentHashOf = (options: { product: ResolvedProduct; resolved: ResolvedPart; kind: PictureKind }) => {
  const { product, resolved, kind } = options;

  return kind === 'review'
    ? partHashOf({ product, dir: dirname(resolved.file) })
    : designHashOf({ product, part: resolved }).hash;
};

/**
 * The work of `design check` on the pictures of each part: stores the pictures of a review or go that holds and has
 * none at its hash, and carries a review or go whose hash moved to the new hash, as an `auto` acceptance, when every
 * state still draws as in the pictures stored while it held. Answers with one line per part it drew.
 */
export const autoAcceptOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  only?: string;
  draw?: DrawStates;
}): Promise<string[]> => {
  const { target, config, product, only } = options;
  const unreviewed = new Set(changedOutsideSketchOf(product));
  const merged = readMerged(product.dir);
  const needs = new Map<string, Need[]>();

  for (const resolved of product.parts) {
    const part = partKeyOf(resolved);

    if (only && part !== only) continue;

    const { dir } = partOwnerOf({ product, part: resolved });
    const pictures = readPictures(dir)[part] ?? {};
    const ofPart: Need[] = [];
    const reviewed = merged[part];

    if (resolved.origin !== 'base' && reviewed !== undefined) {
      const now = currentHashOf({ product, resolved, kind: 'review' });

      if (reviewed === now) {
        if (pictures.review?.hash !== reviewed) ofPart.push({ kind: 'review', hash: reviewed, now, carry: null });
      } else if (pictures.review?.hash === reviewed && unreviewed.has(part))
        ofPart.push({ kind: 'review', hash: reviewed, now, carry: pictures.review });
    }

    const go = readGo(dir)[part];

    if (go) {
      const design = designHashOf({ product, part: resolved });

      if (recordHolds(go, design)) {
        if (pictures.go?.hash !== go.hash) ofPart.push({ kind: 'go', hash: go.hash, now: design.hash, carry: null });
      } else if (pictures.go?.hash === go.hash)
        ofPart.push({ kind: 'go', hash: go.hash, now: design.hash, carry: pictures.go });
    }

    if (ofPart.length > 0) needs.set(part, ofPart);
  }

  if (needs.size === 0) return [];

  const expected = Object.fromEntries(
    [...needs].flatMap(([part, ofPart]) => {
      const carry = ofPart.find((need) => need.carry)?.carry;

      return carry ? [[part, carry.states]] : [];
    }),
  );
  const drawn = await (options.draw ?? drawStatePictures)({
    target,
    config,
    product,
    parts: [...needs.keys()],
    expected,
  });
  const lines: string[] = [];

  for (const [part, ofPart] of needs) {
    const states = drawn.get(part);

    if (states === undefined || typeof states === 'string') {
      lines.push(`PICTURES NOT DRAWN ${product.name} ${part}: ${states ?? 'no drawing'}`);
      continue;
    }

    const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

    if (!resolved) continue;

    const { dir } = partOwnerOf({ product, part: resolved });
    const carried: PictureKind[] = [];
    const changed = new Set<string>();

    for (const need of ofPart) {
      if (currentHashOf({ product, resolved, kind: need.kind }) !== need.now) {
        lines.push(`PICTURES NOT DRAWN ${product.name} ${part}: changed while it was drawn`);
        continue;
      }

      if (!need.carry) {
        writePictures({ dir, part, kind: need.kind, pictures: { hash: need.hash, states } });
        continue;
      }

      const differs = changedStatesOf(need.carry.states, states);

      if (differs.length > 0) {
        differs.forEach((state) => changed.add(state));
        continue;
      }

      if (need.kind === 'review') {
        const previous = readAccepted(product.dir)
          .filter((entry) => entry.part === part)
          .pop()?.by;

        recordAutoReview({ product, part, by: autoAcceptBy(previous) });
        writePictures({ dir, part, kind: 'review', pictures: { hash: need.now, states } });
      } else {
        const previous = readGo(dir)[part];

        if (!previous || previous.hash !== need.hash) continue;

        const go: PartGo = {
          ...previous,
          hash: need.now,
          files: designHashOf({ product, part: resolved }).files,
          by: autoAcceptBy(previous.by),
          at: new Date().toISOString(),
          auto: true,
        };

        writeGo({ dir, part, go });
        writePictures({ dir, part, kind: 'go', pictures: { hash: need.now, states } });
      }

      carried.push(need.kind);
    }

    if (carried.length > 0)
      lines.push(
        `AUTO ACCEPTED ${product.name} ${part} (${carried.join(', ')}): every state draws as at the last acceptance`,
      );
    if (changed.size > 0)
      lines.push(
        `PICTURES CHANGED ${product.name} ${part}: ${[...changed].sort((a, b) => a.localeCompare(b)).join(', ')}`,
      );
  }

  return lines;
};
