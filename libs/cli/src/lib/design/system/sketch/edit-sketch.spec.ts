import { execFileSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { readOpenPoints } from '../read-open-points';
import { resolveProduct } from '../resolve-product';
import { openEditSketch } from './edit-sketch';
import { mergeSketch } from './merge';
import { changedOutsideSketchOf, readMerged, recordMerged } from './merged-parts';
import { decideSketch, Sketch } from './sketch';

const HERO = 'elements/hero';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-sketch-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  const product = resolveAcme(target);
  const css = join(product.dir, HERO, 'hero.css');

  recordMerged({ product, parts: [HERO] });
  execFileSync('git', ['init', '-q'], { cwd: target });
  execFileSync('git', ['add', '.'], { cwd: target });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { cwd: target });

  return { target, css, head: readFileSync(css, 'utf8') };
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
    const picked = decideSketch({ sketch, decision: { kind: 'pick', variant: 'old' } }) as Sketch;
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

  it('opens no sketch when HEAD holds the edit already', () => {
    const { target } = acme();

    expect(openEditSketch({ target, product: resolveAcme(target), part: HERO })).toBe(
      `HEAD holds the edit of ${HERO} already - there is no old design to show`,
    );
  });
});
