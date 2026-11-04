import { execFileSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { designAccept } from './accept-command';
import { autoAcceptOf, DrawStates, readPictures, StatePictures } from './accepted-pictures';
import { designHashOf } from './design-hash';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { partKeyOf, resolveProduct } from './resolve-product';
import { changedOutsideSketchOf, directEditsOf, readMerged, recordMerged } from './sketch/merged-parts';

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
  execFileSync('git', ['init', '-q'], { cwd: target });
  execFileSync('git', ['add', '.'], { cwd: target });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { cwd: target });

  return { target, dir: join(design, 'app-a'), chip: join(design, 'app-a/components/chip/chip.ts') };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const designHashOfChip = (target: string) => {
  const product = productOf(target);
  const part = product.parts.find((candidate) => partKeyOf(candidate) === CHIP);

  return part ? designHashOf({ product, part }).hash : '';
};

const drawing = (initial: StatePictures) => {
  const calls: string[][] = [];
  const variants: (string | null)[] = [];
  const pictures: { now: StatePictures; head?: StatePictures } = { now: initial };
  const draw: DrawStates = async ({ parts, sketch }) => {
    calls.push(parts);
    variants.push(sketch?.variant ?? null);

    return new Map(parts.map((part) => [part, { ...(sketch ? (pictures.head ?? pictures.now) : pictures.now) }]));
  };

  return { draw, calls, variants, pictures };
};

const autoAccept = (target: string, draw: DrawStates) =>
  autoAcceptOf({ target, config: {}, product: productOf(target), draw });

describe('autoAcceptOf', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stores the record pictures of a merged part at its design hash and draws them once', async () => {
    const { target, dir } = checkout();
    const { draw, calls } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });

    expect(await autoAccept(target, draw)).toEqual([]);
    expect(readPictures(dir)[CHIP]).toEqual({
      record: { hash: designHashOfChip(target), states: { default: 'a1', hover: 'b2' }, slots: true },
    });
    expect(await autoAccept(target, draw)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('holds a direct edit at once when every state draws as before, without accepted.json or a sketch', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    await autoAccept(target, draw);
    appendFileSync(chip, '// attribute-only edit\n');

    expect(changedOutsideSketchOf(productOf(target))).toEqual([CHIP]);
    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(changedOutsideSketchOf(productOf(target))).toEqual([]);
    expect(readPictures(dir)[CHIP]?.record?.hash).toBe(designHashOfChip(target));
    expect(existsSync(join(dir, 'accepted.json'))).toBe(false);
    expect(existsSync(join(dir, 'sketches'))).toBe(false);
  });

  it('opens the old/new sketch for a direct edit that changes a picture', async () => {
    const { target, dir, chip } = checkout();
    const { draw, pictures } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    await autoAccept(target, draw);
    appendFileSync(chip, '// visible edit\n');
    pictures.now = { default: 'a1', hover: 'c3' };

    expect(await autoAccept(target, draw)).toEqual([
      `PICTURES CHANGED app-a ${CHIP}: hover`,
      `DIRECT EDIT app-a ${CHIP}: changed outside a sketch - pick old or new in sketch ${CHIP}@edit`,
    ]);
    expect(partPointsOf(readOpenPoints(productOf(target)), CHIP)).toContainEqual({
      kind: 'direct-edit',
      sketch: `${CHIP}@edit`,
    });
    expect(existsSync(join(dir, 'accepted.json'))).toBe(false);
  });

  it('compares a direct edit with the older review pictures at the merged hash', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    writeFileSync(
      join(dir, 'pictures.json'),
      JSON.stringify({
        [CHIP]: { review: { hash: readMerged(dir)[CHIP], states: { default: 'a1', hover: 'b2' }, slots: true } },
      }),
    );
    appendFileSync(chip, '// attribute-only edit\n');

    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(Object.keys(readPictures(dir)[CHIP] ?? {})).toEqual(['record']);
  });

  it('compares a direct edit with the design at HEAD when no pictures drawn with slots exist', async () => {
    const { target, dir, chip } = checkout();
    const { draw, variants } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    writeFileSync(
      join(dir, 'pictures.json'),
      JSON.stringify({ [CHIP]: { review: { hash: readMerged(dir)[CHIP], states: { default: 'a1' } } } }),
    );
    appendFileSync(chip, '// edit inside a slot\n');

    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(variants).toEqual(['old', null]);
    expect(directEditsOf(productOf(target))).toEqual([]);
  });

  it('compares a direct edit with the design at HEAD, not with go pictures of an older hash', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    writeFileSync(
      join(dir, 'pictures.json'),
      JSON.stringify({ [CHIP]: { go: { hash: 'cccece47', states: { default: 'x9', hover: 'y8' }, slots: true } } }),
    );
    appendFileSync(chip, '// attribute-only edit\n');

    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(directEditsOf(productOf(target))).toEqual([]);
  });

  it('leaves the old/new sketch open when the edit draws a state differently from HEAD', async () => {
    const { target, chip } = checkout();
    const { draw, pictures } = drawing({ default: 'a1', hover: 'c3' });

    pictures.head = { default: 'a1', hover: 'b2' };
    recordMerged({ product: productOf(target), parts: [CHIP] });
    appendFileSync(chip, '// visible edit\n');

    expect(await autoAccept(target, draw)).toEqual([
      `PICTURES CHANGED app-a ${CHIP}: hover`,
      `DIRECT EDIT app-a ${CHIP}: changed outside a sketch - pick old or new in sketch ${CHIP}@edit`,
    ]);
    expect(partPointsOf(readOpenPoints(productOf(target)), CHIP)).toContainEqual({
      kind: 'direct-edit',
      sketch: `${CHIP}@edit`,
    });
  });

  it('stores pictures after design accept', async () => {
    const { target, dir, chip } = checkout();
    const { draw } = drawing({ default: 'a1', hover: 'b2' });

    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    recordMerged({ product: productOf(target), parts: [CHIP] });
    appendFileSync(chip, '// edit\n');

    expect(
      await designAccept({
        target,
        argv: [CHIP, '--product', 'app-a', '--by', 'tom', '--note', 'approved'],
        invocation: 'et',
        draw,
        prompt: { isTTY: true, ask: async () => 'y' },
      }),
    ).toBe(0);
    expect(readPictures(dir)[CHIP]?.record).toEqual({
      hash: designHashOfChip(target),
      states: { default: 'a1', hover: 'b2' },
      slots: true,
    });
  });
});
