import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { designAccept } from './accept-command';
import { autoAcceptOf, DrawStates, readPictures, StatePictures } from './accepted-pictures';
import { designGo } from './go-command';
import { goStateOf, markPartGo, readGo } from './part-go';
import { resolveProduct } from './resolve-product';
import { changedOutsideSketchOf, readAccepted, readMerged, recordMerged } from './sketch/merged-parts';

const CHIP = 'components/chip';

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-accepted-pictures-'));
  const design = join(target, DESIGN_DIR);
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), source);
  };

  write(
    `${DESIGN_DIR}/app-a/components/chip/chip.ts`,
    'export default definePart({ states: { default: {}, hover: {} } });\n',
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, dir: join(design, 'app-a'), chip: join(design, 'app-a/components/chip/chip.ts') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const drawing = (initial: StatePictures) => {
  const calls: string[][] = [];
  const pictures = { now: initial };
  const draw: DrawStates = async ({ parts }) => {
    calls.push(parts);

    return new Map(parts.map((part) => [part, { ...pictures.now }]));
  };

  return { draw, calls, pictures };
};

const autoAccept = (target: string, draw: DrawStates) =>
  autoAcceptOf({ target, config: {}, product: productOf(target), draw });

describe('autoAcceptOf', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stores the pictures of a go that holds, and carries the go when every state draws the same', async () => {
    const { target, dir, chip } = checkout();
    const { draw, calls } = drawing({ default: 'a1', hover: 'b2' });
    const go = markPartGo({ product: productOf(target), part: CHIP, by: 'tom', note: 'Impl Q1' });

    expect(await autoAccept(target, draw)).toEqual([]);
    expect(readPictures(dir)[CHIP]?.go).toEqual({
      hash: 'hash' in go ? go.hash : '',
      states: { default: 'a1', hover: 'b2' },
    });
    expect(await autoAccept(target, draw)).toEqual([]);
    expect(calls).toHaveLength(1);

    appendFileSync(chip, '// attribute-only edit\n');

    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('stale');
    expect(await autoAccept(target, draw)).toEqual([
      `AUTO ACCEPTED app-a ${CHIP} (go): every state draws as at the last acceptance`,
    ]);
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('current');
    expect(readGo(dir)[CHIP]).toMatchObject({ by: 'tom', note: 'Impl Q1', auto: true });
    expect(readPictures(dir)[CHIP]?.go?.hash).toBe(readGo(dir)[CHIP]?.hash);
  });

  it('keeps a go stale when a state draws differently or the state set changed', async () => {
    const { target, dir, chip } = checkout();
    const { draw, pictures } = drawing({ default: 'a1', hover: 'b2' });

    markPartGo({ product: productOf(target), part: CHIP, by: 'tom' });
    await autoAccept(target, draw);
    appendFileSync(chip, '// visible edit\n');
    pictures.now = { default: 'a1', hover: 'c3' };

    expect(await autoAccept(target, draw)).toEqual([`PICTURES CHANGED app-a ${CHIP}: hover`]);
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('stale');

    pictures.now = { default: 'a1', hover: 'b2', focus: 'd4' };

    expect(await autoAccept(target, draw)).toEqual([`PICTURES CHANGED app-a ${CHIP}: focus`]);
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('stale');
    expect(readGo(dir)[CHIP]?.auto).toBeUndefined();
  });

  it('never carries a stale go that has no pictures from while it held', async () => {
    const { target, chip } = checkout();
    const { draw, calls } = drawing({ default: 'a1', hover: 'b2' });

    markPartGo({ product: productOf(target), part: CHIP, by: 'tom' });
    appendFileSync(chip, '// edit before any pictures\n');

    expect(await autoAccept(target, draw)).toEqual([]);
    expect(calls).toEqual([]);
    expect(goStateOf({ product: productOf(target), part: CHIP })).toBe('stale');
  });

  it('accepts a direct edit by itself when every state draws as at the last review', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    await autoAccept(target, draw);

    expect(readPictures(dir)[CHIP]?.review?.hash).toBe(readMerged(dir)[CHIP]);

    appendFileSync(chip, '// attribute-only edit\n');

    expect(changedOutsideSketchOf(productOf(target))).toEqual([CHIP]);
    expect(await autoAccept(target, draw)).toEqual([
      `AUTO ACCEPTED app-a ${CHIP} (review): every state draws as at the last acceptance`,
    ]);
    expect(changedOutsideSketchOf(productOf(target))).toEqual([]);
    expect(readAccepted(dir)).toEqual([
      expect.objectContaining({ part: CHIP, by: 'design check', auto: true, hash: readMerged(dir)[CHIP] }),
    ]);
  });

  it('stores pictures after design go and design accept', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(
      await designGo({ target, argv: [CHIP, '--product', 'app-a', '--by', 'claude'], invocation: 'et', draw }),
    ).toBe(0);
    expect(readPictures(dir)[CHIP]?.go).toEqual({
      hash: readGo(dir)[CHIP]?.hash,
      states: { default: 'a1', hover: 'b2' },
    });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    appendFileSync(chip, '// edit\n');

    expect(
      await designAccept({
        target,
        argv: [CHIP, '--product', 'app-a', '--by', 'claude', '--note', 'approved'],
        invocation: 'et',
        draw,
      }),
    ).toBe(0);
    expect(readPictures(dir)[CHIP]?.review).toEqual({
      hash: readMerged(dir)[CHIP],
      states: { default: 'a1', hover: 'b2' },
    });
  });
});
