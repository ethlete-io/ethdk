import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, DesignConfig } from '../design-config';
import { gitExec } from '../../git-test-env.fixtures';
import { autoAcceptOf, DrawStates, StatePictures } from './accepted-pictures';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { readMerged, recordMerged } from './sketch/merged-parts';

const FIXTURES = join(__dirname, '__fixtures__/token-rename-b757');
const CONFIG: DesignConfig = {
  render: { packages: { '@ethlete/core': resolve(__dirname, '../../../../../core') } },
};

const fixtureOf = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

const checkout = (part: string, css: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rename-'));
  const design = join(target, DESIGN_DIR);
  const folder = join(design, 'app-a/components', part);

  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${part}.ts`), 'export default definePart({ states: { default: {} } });\n');
  writeFileSync(join(folder, `${part}.css`), css);
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  gitExec(['init', '-q'], { cwd: target });
  gitExec(['add', '.'], { cwd: target });
  gitExec(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { cwd: target });

  return { target, dir: join(design, 'app-a'), css: join(folder, `${part}.css`), key: `components/${part}` };
};

const productOf = (target: string) => resolveProduct({ target, name: 'app-a', config: {} });

const drawing = () => {
  const pictures: { now: StatePictures } = { now: { default: 'old-tokens' } };
  const draw: DrawStates = async ({ parts }) => new Map(parts.map((part) => [part, { ...pictures.now }]));

  return { draw, pictures };
};

const autoAccept = (target: string, draw: DrawStates) =>
  autoAcceptOf({ target, config: CONFIG, product: productOf(target), draw });

const partHashNowOf = (target: string, key: string) =>
  partHashOf({ product: productOf(target), dir: join(target, DESIGN_DIR, 'app-a', key) });

describe('autoAcceptOf on a theme token rename (B757)', () => {
  it.each(['badge', 'bracket'])(
    'holds the real sdk %s rename of f09555052b without a sketch, though it draws differently',
    async (part) => {
      const { target, dir, css, key } = checkout(part, fixtureOf(`${part}.before.css`));
      const { draw, pictures } = drawing();

      recordMerged({ product: productOf(target), parts: [key] });
      await autoAccept(target, draw);
      writeFileSync(css, fixtureOf(`${part}.after.css`));
      pictures.now = { default: 'new-tokens' };

      expect(await autoAccept(target, draw)).toEqual([
        `RENAMED app-a ${key}: changed outside a sketch, only theme tokens renamed`,
      ]);
      expect(existsSync(join(dir, 'sketches'))).toBe(false);
      expect(partPointsOf(readOpenPoints(productOf(target)), key)).not.toContainEqual(
        expect.objectContaining({ kind: 'direct-edit' }),
      );
      expect(readMerged(dir)[key]).toBe(partHashNowOf(target, key));
    },
  );

  it('opens the old/new sketch for a rename plus a real value change', async () => {
    const { target, css, key } = checkout('badge', fixtureOf('badge.before.css'));
    const { draw, pictures } = drawing();

    recordMerged({ product: productOf(target), parts: [key] });
    await autoAccept(target, draw);
    writeFileSync(
      css,
      fixtureOf('badge.after.css').replace('background: var(--et-surface-background);', 'background: red;'),
    );
    pictures.now = { default: 'new-tokens' };

    expect(await autoAccept(target, draw)).toEqual([
      `PICTURES CHANGED app-a ${key}: default`,
      `DIRECT EDIT app-a ${key}: changed outside a sketch - pick old or new in sketch ${key}@edit`,
    ]);
    expect(partPointsOf(readOpenPoints(productOf(target)), key)).toContainEqual({
      kind: 'direct-edit',
      sketch: `${key}@edit`,
    });
  });

  it('closes an edit sketch an earlier run opened for a pure rename', async () => {
    const { target, dir, css, key } = checkout('badge', fixtureOf('badge.before.css'));
    const { draw, pictures } = drawing();

    recordMerged({ product: productOf(target), parts: [key] });
    await autoAccept(target, draw);
    writeFileSync(
      css,
      fixtureOf('badge.after.css').replace('background: var(--et-surface-background);', 'background: red;'),
    );
    pictures.now = { default: 'new-tokens' };
    await autoAccept(target, draw);
    expect(existsSync(join(dir, 'sketches/components-badge.edit'))).toBe(true);

    writeFileSync(css, fixtureOf('badge.after.css'));

    expect(await autoAccept(target, draw)).toEqual([
      `RENAMED app-a ${key}: changed outside a sketch, only theme tokens renamed`,
    ]);
    expect(existsSync(join(dir, 'sketches/components-badge.edit'))).toBe(false);
    expect(partPointsOf(readOpenPoints(productOf(target)), key)).not.toContainEqual(
      expect.objectContaining({ kind: 'direct-edit' }),
    );
  });
});
