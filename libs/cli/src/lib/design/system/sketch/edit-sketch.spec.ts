import { originOf } from '../write-origin';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { readOpenPoints } from '../read-open-points';
import { commitAll, git, initGitRepo } from '../git-repo.fixtures';
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
  initGitRepo(target, 'base');

  return { target, css, head: readFileSync(css, 'utf8') };
};

const commit = (target: string) => commitAll(target, 'edit');

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

  it('refuses the merge naming the commit order while a part the edit embeds holds an uncommitted change', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, css } = acme();
    const button = join(resolveAcme(target).dir, 'components/button/button.css');

    writeFileSync(button, '.acme-button { padding: 0; }\n');
    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;
    const picked = decideSketch({ sketch, decision: { kind: 'pick', variant: 'new', ...originOf('spec') } }) as Sketch;
    const mergeOnce = () =>
      mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch: picked });

    expect(mergeOnce()).toEqual({
      reason: `components/button holds uncommitted changes that ${HERO}@edit was drawn on, and a merge checks against HEAD - commit components/button first, then merge ${HERO}@edit`,
      changed: ['components/button'],
    });

    git(target, 'commit', '-m', 'button', '--', button);

    expect(mergeOnce()).toEqual([HERO]);
    expect(readFileSync(css, 'utf8')).toContain('padding: 0;');
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

  it('takes old from the part at HEAD when no commit holds its merged hash', () => {
    const { target, css, head } = acme();
    const mergedFile = join(resolveAcme(target).dir, 'merged.json');
    const entries = JSON.parse(readFileSync(mergedFile, 'utf8')) as Record<string, { hash: string }>;

    writeFileSync(mergedFile, JSON.stringify({ ...entries, [HERO]: { ...entries[HERO], hash: '0123456789abcdef' } }));
    commit(target);
    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;

    expect(sketch.variants).toEqual(['new', 'old']);
    expect(readFileSync(join(sketch.dir, 'old', HERO, 'hero.css'), 'utf8')).toBe(head);
  });

  it('opens no sketch when the part folder is at HEAD', () => {
    const { target } = acme();

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toBe(
      `the folder of ${HERO} at HEAD equals the working one - there is no old design to show`,
    );
  });

  it('opens no sketch for a committed edit, which HEAD holds as its merged design', () => {
    const { target, css } = acme();

    writeFileSync(css, '.acme-hero { padding: 0; }\n');
    commit(target);

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toMatch(
      /at HEAD equals the working one/u,
    );
  });

  it('takes old from the newest committed edit when the part changed again after it', () => {
    const { target, css } = acme();

    writeFileSync(css, '.acme-hero { padding: 1px; }\n');
    commit(target);
    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = openEditSketch({ target, product: resolveAcme(target), part: HERO }) as Sketch;

    expect(readFileSync(join(sketch.dir, 'old', HERO, 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 1px; }\n');
    expect(readFileSync(join(sketch.dir, 'new', HERO, 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }\n');
  });

  it('opens a ready sketch with only new and answers EDIT-OLD-NOT-FOUND when HEAD holds no file of the part', () => {
    const { target } = acme();

    git(target, 'rm', '-r', '--cached', '-q', join(resolveAcme(target).dir, HERO));
    git(target, 'commit', '-qm', 'untrack');

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toEqual({
      rule: 'EDIT-OLD-NOT-FOUND',
      message: expect.stringContaining(`${HERO} gets a sketch with only the variant new`),
      sketch: expect.objectContaining({ target: `${HERO}@edit`, status: 'ready', variants: ['new'] }),
    });
  });
});
