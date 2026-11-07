import { execFileSync } from 'child_process';
import { originOf } from '../write-origin';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { readOpenPoints } from '../read-open-points';
import { resolveProduct } from '../resolve-product';
import { openEditSketch } from './edit-sketch';
import { mergeSketch } from './merge';
import { changedOutsideSketchOf, readMerged, recordMerged } from './merged-parts';
import { decideSketch, Sketch } from './sketch';

const HERO = 'elements/hero';

const acme = (seed?: (heroDir: string) => void) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-sketch-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  seed?.(join(resolveAcme(target).dir, HERO));

  const product = resolveAcme(target);
  const css = join(product.dir, HERO, 'hero.css');

  recordMerged({ product, parts: [HERO] });
  execFileSync('git', ['init', '-q'], { cwd: target });
  execFileSync('git', ['add', '.'], { cwd: target });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { cwd: target });

  return { target, css, head: readFileSync(css, 'utf8') };
};

const commit = (target: string) => {
  execFileSync('git', ['add', '.'], { cwd: target });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'edit'], { cwd: target });
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

describe('openEditSketch', () => {
  it('opens a ready sketch with the design at HEAD as old and the edit as new, and the part shows a direct edit', () => {
    const { target, css, head } = acme();

    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;

    expect(sketch.target).toBe(`${HERO}@edit`);
    expect(sketch.status).toBe('ready');
    expect(sketch.variants).toEqual(['new', 'old']);
    expect(readFileSync(join(sketch.dir, 'old', HERO, 'hero.css'), 'utf8')).toBe(head);
    expect(readFileSync(join(sketch.dir, 'new', HERO, 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }\n');
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    const points = readOpenPoints(resolveAcme(target)).find(({ part }) => part === HERO)?.points ?? [];

    expect(points).toContainEqual({ kind: 'direct-edit', sketch: `${HERO}@edit` });
    expect(points.some((point) => point.kind === 'unmerged-sketch')).toBe(false);
  });

  it('merges a pick of old like any sketch: the part is back at HEAD and recorded', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, css, head } = acme();

    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;
    const picked = decideSketch({ sketch, decision: { kind: 'pick', variant: 'old', ...originOf('spec') } }) as Sketch;
    const merged = mergeSketch({
      target,
      config: readConfig(target) ?? {},
      product: resolveAcme(target),
      sketch: picked,
    });

    expect(merged).toEqual([HERO]);
    expect(readFileSync(css, 'utf8')).toBe(head);
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
    expect(Object.keys(readMerged(join(target, DESIGN_DIR, 'acme')))).toContain(HERO);
  });

  it('keeps the shared files at HEAD for old when the edit changed them', () => {
    const { target } = acme((heroDir) => {
      mkdirSync(join(heroDir, 'shared'));
      writeFileSync(join(heroDir, 'shared', 'tone.ts'), "export const tone = 'head';\n");
      writeFileSync(
        join(heroDir, 'hero.ts'),
        `import { tone } from './shared/tone';\n${readFileSync(join(heroDir, 'hero.ts'), 'utf8')}`,
      );
    });
    const tone = join(resolveAcme(target).dir, HERO, 'shared', 'tone.ts');

    writeFileSync(tone, "export const tone = 'edit';\n");

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;

    expect(readFileSync(join(sketch.dir, 'old', 'shared', 'tone.ts'), 'utf8')).toBe("export const tone = 'head';\n");
    expect(readFileSync(join(sketch.dir, 'shared', 'tone.ts'), 'utf8')).toBe("export const tone = 'edit';\n");
    expect(readFileSync(join(sketch.dir, 'old', HERO, 'hero.ts'), 'utf8')).toContain("from '@shared/tone'");
  });

  it('points an import that leaves the old shared folder at the same file from the sketch', () => {
    const { target } = acme((heroDir) => {
      mkdirSync(join(heroDir, 'shared'));
      writeFileSync(join(heroDir, '..', '..', 'outside.ts'), 'export const outside = 1;\n');
      writeFileSync(
        join(heroDir, 'shared', 'tone.ts'),
        "import { outside } from '../../../outside';\nexport { outside };\n",
      );
      writeFileSync(
        join(heroDir, 'hero.ts'),
        `import { outside } from './shared/tone';\n${readFileSync(join(heroDir, 'hero.ts'), 'utf8')}`,
      );
    });
    const product = resolveAcme(target);

    writeFileSync(join(product.dir, HERO, 'hero.css'), '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product, part: HERO }) as Sketch;
    const written =
      /from '([^']+)'/u.exec(readFileSync(join(sketch.dir, 'old', 'shared', 'tone.ts'), 'utf8'))?.[1] ?? '';

    expect(`${resolve(sketch.dir, 'old', 'shared', written)}.ts`).toBe(join(product.dir, 'outside.ts'));
  });

  it('opens no sketch when the part folder is at its merged commit', () => {
    const { target } = acme();

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toMatch(
      new RegExp(`^the folder of ${HERO} at its merged commit [0-9a-f]{9} equals the working one`, 'u'),
    );
  });

  it('takes old from the newest commit at the merged hash when the edit is committed', () => {
    const { target, css, head } = acme();

    writeFileSync(css, '.acme-hero { padding: 1px; }\n');
    commit(target);
    writeFileSync(css, '.acme-hero { padding: 0; }\n');
    commit(target);

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;

    expect(readFileSync(join(sketch.dir, 'old', HERO, 'hero.css'), 'utf8')).toBe(head);
    expect(readFileSync(join(sketch.dir, 'new', HERO, 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }\n');
  });

  it('writes the part at its merged commit back on a pick of old of a committed edit', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, css, head } = acme();

    writeFileSync(css, '.acme-hero { padding: 0; }\n');
    commit(target);

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;
    const picked = decideSketch({ sketch, decision: { kind: 'pick', variant: 'old', ...originOf('spec') } }) as Sketch;

    mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch: picked });

    expect(readFileSync(css, 'utf8')).toBe(head);
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
  });

  it('answers EDIT-OLD-NOT-FOUND with the command to run when no commit has the merged hash', () => {
    const { target, css } = acme();

    writeFileSync(css, '.acme-hero { padding: 1px; }\n');
    recordMerged({ product: resolveAcme(target), parts: [HERO] });
    writeFileSync(css, '.acme-hero { padding: 0; }\n');
    commit(target);

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toEqual({
      rule: 'EDIT-OLD-NOT-FOUND',
      message: expect.stringContaining(`et design accept ${HERO} --product acme`),
    });
  });
});
