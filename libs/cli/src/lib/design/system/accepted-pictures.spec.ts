import { execFileSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { designAccept } from './accept-command';
import { autoAcceptOf, DrawStates, readPictures, StatePictures } from './accepted-pictures';
import { designHashOf } from './design-hash';
import { Problem } from './problem';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { partKeyOf, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
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
      record: {
        hash: designHashOfChip(target),
        states: { default: 'a1', hover: 'b2' },
        slots: true,
        partHash: readMerged(dir)[CHIP],
      },
    });
    expect(await autoAccept(target, draw)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('holds a direct edit at once when every state draws as before, without accepted.json or a sketch', async () => {
    const { target, dir, chip } = checkout();
    const { draw, variants } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    await autoAccept(target, draw);
    appendFileSync(chip, '// attribute-only edit\n');

    expect(changedOutsideSketchOf(productOf(target))).toEqual([CHIP]);
    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(variants).toEqual([null, null]);
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

  it('compares a direct edit with the design at HEAD, not with a record drawn at another part hash', async () => {
    const { target, dir, chip } = checkout();
    const { draw, variants } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    writeFileSync(
      join(dir, 'pictures.json'),
      JSON.stringify({
        [CHIP]: {
          record: { hash: 'd1', states: { default: 'x9', hover: 'y8' }, slots: true, partHash: 'stale' },
        },
      }),
    );
    appendFileSync(chip, '// attribute-only edit\n');

    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(variants).toEqual(['old', null]);
  });

  it('compares a direct edit with the design at HEAD, not with go pictures at the merged hash', async () => {
    const { target, dir, chip } = checkout();
    const { draw, variants } = drawing({ default: 'a1', hover: 'b2' });

    recordMerged({ product: productOf(target), parts: [CHIP] });
    writeFileSync(
      join(dir, 'pictures.json'),
      JSON.stringify({
        [CHIP]: { go: { hash: readMerged(dir)[CHIP], states: { default: 'x9', hover: 'y8' }, slots: true } },
      }),
    );
    appendFileSync(chip, '// attribute-only edit\n');

    expect(await autoAccept(target, draw)).toEqual([
      `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
    ]);
    expect(variants).toEqual(['old', null]);
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

  describe('a committed direct edit', () => {
    const commitAll = (target: string) => {
      execFileSync('git', ['add', '.'], { cwd: target });
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'edit'], { cwd: target });
    };

    it('holds a refactor drawn against the part at its merged commit', async () => {
      const { target, dir, chip } = checkout();
      const { draw, variants } = drawing({ default: 'a1', hover: 'b2' });

      recordMerged({ product: productOf(target), parts: [CHIP] });
      writeFileSync(chip, 'export default definePart({ states: { hover: {}, default: {} } });\n');
      commitAll(target);

      expect(await autoAccept(target, draw)).toEqual([
        `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
      ]);
      expect(variants).toContain('old');
      expect(readMerged(dir)[CHIP]).toBe(partHashOf({ product: productOf(target), dir: dirname(chip) }));
    });

    it('reports a merged hash no commit holds as a problem with the command to run', async () => {
      const { target, dir, chip } = checkout();
      const { draw } = drawing({ default: 'a1', hover: 'b2' });

      writeFileSync(chip, 'export default definePart({ states: { default: {} } });\n');
      recordMerged({ product: productOf(target), parts: [CHIP] });
      writeFileSync(chip, 'export default definePart({ states: { hover: {}, default: {} } });\n');
      commitAll(target);

      const problems: Problem[] = [];

      expect(await autoAcceptOf({ target, config: {}, product: productOf(target), draw, problems })).toEqual([]);
      expect(problems).toEqual([
        {
          rule: 'EDIT-OLD-NOT-FOUND',
          file: chip,
          message: expect.stringContaining(`et design accept ${CHIP} --product app-a`),
        },
      ]);
      expect(existsSync(join(dir, 'sketches', 'components-chip.edit'))).toBe(false);
    });
  });

  describe('an open edit sketch', () => {
    const sketchFileOf = (dir: string) => join(dir, 'sketches', 'components-chip.edit', 'sketch.json');

    const openSketch = async () => {
      const { target, dir, chip } = checkout();
      const drawn = drawing({ default: 'a1', hover: 'c3' });

      drawn.pictures.head = { default: 'a1', hover: 'b2' };
      recordMerged({ product: productOf(target), parts: [CHIP] });
      appendFileSync(chip, '// visible edit\n');
      await autoAccept(target, drawn.draw);
      expect(existsSync(sketchFileOf(dir))).toBe(true);

      return { target, dir, chip, ...drawn };
    };

    it('draws nothing and leaves git status as it was on a rerun over an unchanged tree', async () => {
      const { target, dir, draw, calls } = await openSketch();
      const status = () => execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: target, encoding: 'utf8' });
      const sketchJson = readFileSync(sketchFileOf(dir), 'utf8');
      const before = status();

      calls.length = 0;

      for (let run = 0; run < 2; run++)
        expect(await autoAccept(target, draw)).toEqual([
          `PICTURES CHANGED app-a ${CHIP}: hover`,
          `DIRECT EDIT app-a ${CHIP}: changed outside a sketch - pick old or new in sketch ${CHIP}@edit`,
        ]);
      expect(calls).toEqual([]);
      expect(status()).toBe(before);
      expect(readFileSync(sketchFileOf(dir), 'utf8')).toBe(sketchJson);
    });

    it('compares a direct edit with old pictures an earlier run drew, without drawing old or new again', async () => {
      const { target, dir, draw, calls } = await openSketch();

      rmSync(join(dir, 'sketches'), { recursive: true });
      calls.length = 0;

      expect(await autoAccept(target, draw)).toEqual([
        `PICTURES CHANGED app-a ${CHIP}: hover`,
        `DIRECT EDIT app-a ${CHIP}: changed outside a sketch - pick old or new in sketch ${CHIP}@edit`,
      ]);
      expect(calls).toEqual([]);
    });

    it('closes as held when every state now draws the same as HEAD', async () => {
      const { target, dir, chip, draw, pictures } = await openSketch();

      appendFileSync(chip, '// hover drawn as before\n');
      pictures.now = { default: 'a1', hover: 'b2' };

      expect(await autoAccept(target, draw)).toEqual([
        `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
      ]);
      expect(existsSync(sketchFileOf(dir))).toBe(false);
      expect(directEditsOf(productOf(target))).toEqual([]);
    });

    it('stays open while a state draws differently from HEAD', async () => {
      const { target, dir, draw } = await openSketch();

      expect(await autoAccept(target, draw)).toEqual([
        `PICTURES CHANGED app-a ${CHIP}: hover`,
        `DIRECT EDIT app-a ${CHIP}: changed outside a sketch - pick old or new in sketch ${CHIP}@edit`,
      ]);
      expect(existsSync(sketchFileOf(dir))).toBe(true);
    });

    it('stays open untouched once the user decided it', async () => {
      const { target, dir, draw, pictures, variants } = await openSketch();
      const file = sketchFileOf(dir);

      writeFileSync(
        file,
        JSON.stringify({
          ...JSON.parse(readFileSync(file, 'utf8')),
          decision: { kind: 'pick', variant: 'new', decidedAt: '2026-11-04T00:00:00.000Z' },
        }),
      );
      pictures.now = { default: 'a1', hover: 'b2' };
      variants.length = 0;

      expect(await autoAccept(target, draw)).toEqual([]);
      expect(existsSync(file)).toBe(true);
      expect(variants).not.toContain('old');
    });

    it('draws old from HEAD, not from a stored old/ that imports an export its shared/ has renamed since', async () => {
      const { target, dir, chip } = checkout();
      const sketchDir = join(dir, 'sketches', 'components-chip.edit');
      const shared = join(dirname(chip), 'shared', 'canvas.ts');
      const commit = () => {
        execFileSync('git', ['add', '.'], { cwd: target });
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'next'], { cwd: target });
      };
      const partOf = (name: string) =>
        `import { ${name} } from './shared/canvas';\nexport default definePart({ states: { default: {}, hover: {} } });\n`;
      const draw: DrawStates = async ({ parts, sketch }) => {
        if (!sketch) return new Map(parts.map((part) => [part, { default: 'a1', hover: 'b2' }]));

        const source = readFileSync(join(sketchDir, 'old', 'components', 'chip', 'chip.ts'), 'utf8');
        const name = /import \{ (\w+) \}/u.exec(source)?.[1] ?? '';
        const ownShared = join(sketchDir, 'old', 'shared', 'canvas.ts');
        const exported = readFileSync(
          existsSync(ownShared) ? ownShared : join(sketchDir, 'shared', 'canvas.ts'),
          'utf8',
        );

        return new Map(
          parts.map((part) => [
            part,
            exported.includes(`export const ${name} `)
              ? { default: 'a1', hover: 'b2' }
              : `Importing binding name '${name}' is not found.`,
          ]),
        );
      };

      mkdirSync(dirname(shared), { recursive: true });
      writeFileSync(shared, 'export const emptyCanvas = 1;\n');
      writeFileSync(chip, partOf('emptyCanvas'));
      commit();
      recordMerged({ product: productOf(target), parts: [CHIP] });
      appendFileSync(chip, '// visible edit\n');
      const opening = drawing({ default: 'a1', hover: 'c3' });

      opening.pictures.head = { default: 'a1', hover: 'b2' };
      await autoAccept(target, opening.draw);
      expect(existsSync(join(sketchDir, 'sketch.json'))).toBe(true);

      writeFileSync(shared, 'export const emptyCanvasOf = 1;\n');
      writeFileSync(join(sketchDir, 'shared', 'canvas.ts'), 'export const emptyCanvasOf = 1;\n');
      rmSync(join(sketchDir, 'old', 'shared'), { recursive: true, force: true });
      writeFileSync(chip, partOf('emptyCanvasOf'));
      commit();

      const problems: Problem[] = [];

      expect(await autoAcceptOf({ target, config: {}, product: productOf(target), draw, problems })).toEqual([
        `HELD app-a ${CHIP}: changed outside a sketch, every state draws as before`,
      ]);
      expect(problems).toEqual([]);
      expect(existsSync(join(sketchDir, 'sketch.json'))).toBe(false);
    });

    it('reports an old that does not draw as a check problem, not as a pick', async () => {
      const { target, dir, draw: drawOpen } = await openSketch();
      const problems: Problem[] = [];

      rmSync(join(target, 'node_modules'), { recursive: true });
      const draw: DrawStates = async (options) =>
        options.sketch
          ? new Map(options.parts.map((part) => [part, "Importing binding name 'emptyCanvas' is not found."]))
          : drawOpen(options);

      expect(await autoAcceptOf({ target, config: {}, product: productOf(target), draw, problems })).toEqual([]);
      expect(problems).toEqual([
        {
          rule: 'EDIT-OLD-NOT-DRAWN',
          file: join(dir, 'components', 'chip', 'chip.ts'),
          message: `variant old of ${CHIP}@edit (the part at its merged commit) does not draw: Importing binding name 'emptyCanvas' is not found.`,
        },
      ]);
      expect(existsSync(sketchFileOf(dir))).toBe(true);
      expect(await autoAccept(target, draw)).toEqual([
        `EDIT-OLD-NOT-DRAWN app-a ${CHIP}: variant old of ${CHIP}@edit (the part at its merged commit) does not draw: Importing binding name 'emptyCanvas' is not found.`,
      ]);
    });

    it('rewords the English notes of a sketch opened before they were German', async () => {
      const { target, dir, draw } = await openSketch();
      const stored = JSON.parse(readFileSync(sketchFileOf(dir), 'utf8'));

      stored.rounds[0] = {
        ...stored.rounds[0],
        title: 'Direct edit',
        note: `${CHIP} changed outside a sketch and looks different - pick the design at HEAD or the edit`,
      };
      stored.variantInfo.new.note = 'the edit made outside a sketch';
      stored.variantInfo.old.note = 'the design at HEAD';
      writeFileSync(sketchFileOf(dir), JSON.stringify(stored));

      await autoAccept(target, draw);

      const { rounds, variantInfo } = JSON.parse(readFileSync(sketchFileOf(dir), 'utf8'));

      expect(rounds[0]).toMatchObject({
        title: 'Direkte Änderung',
        note: `${CHIP} wurde außerhalb eines Sketches geändert und sieht anders aus - wähle den zuletzt gemergten Stand oder die Änderung`,
      });
      expect(variantInfo.new.note).toBe('die Änderung außerhalb eines Sketches');
      expect(variantInfo.old.note).toBe('der zuletzt gemergte Stand');
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
      partHash: readMerged(dir)[CHIP],
    });
  });
});
