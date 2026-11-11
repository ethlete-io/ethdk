import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from './design-config';
import { designStatus } from './status';
import { inboxOf } from './system/comments/inbox';
import { resolveProduct } from './system/resolve-product';
import { createSketch, decideSketch, markSketchReady, Sketch } from './system/sketch/sketch';
import { originOf } from './system/write-origin';

vi.mock('./push-status', () => ({
  pushStatusOf: () => ({ base: 'origin/next', unpushed: 0 }),
  pushStatusLines: () => ['nothing unpushed (origin/next)'],
}));

const targets: string[] = [];

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-status-stale-'));

  targets.push(target);
  cpSync(join(__dirname, 'system', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const output = () => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(...String(line).split('\n')));

  return lines;
};

const staleSketches = (target: string) => {
  const product = resolveAcme(target);
  const hero = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;
  const home = createSketch({ product, sketch: { layer: 'pages', name: 'home' }, variants: ['a'] }) as Sketch;
  const card = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

  markSketchReady({ checkout: target, sketch: home });
  decideSketch({ sketch: card, decision: { kind: 'discard', ...originOf('spec') } });
  writeFileSync(join(target, '.ethlete/design/acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

  return { hero, home };
};

afterEach(() => {
  vi.restoreAllMocks();
  targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
});

describe('a sketch whose base part changed after it was drawn', () => {
  it('is named by design status, one line per open or ready sketch with the rebase command', () => {
    const target = acme();
    const lines = output();

    staleSketches(target);

    expect(designStatus({ target, argv: [], invocation: 'et design' })).toBe(0);
    expect(lines.filter((line) => line.startsWith('SKETCH-BASE-STALE'))).toEqual([
      expect.stringMatching(
        /^SKETCH-BASE-STALE acme elements\/hero: elements\/hero changed .* run et design sketch rebase elements\/hero --product acme/u,
      ),
      expect.stringMatching(
        /^SKETCH-BASE-STALE acme pages\/home: elements\/hero changed .* run et design sketch rebase pages\/home --product acme/u,
      ),
    ]);
  });

  it('prints only the stale sketches with --stale, and nothing while every base is current', () => {
    const target = acme();
    const lines = output();

    createSketch({ product: resolveAcme(target), sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    expect(designStatus({ target, argv: ['--stale'], invocation: 'et design' })).toBe(0);
    expect(lines).toEqual([]);

    writeFileSync(join(target, '.ethlete/design/acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(designStatus({ target, argv: ['--stale'], invocation: 'et design' })).toBe(0);
    expect(lines).toEqual([expect.stringMatching(/^SKETCH-BASE-STALE acme elements\/hero: /u)]);
  });

  it('is named by the inbox as a rebase item', () => {
    const target = acme();

    staleSketches(target);

    expect(
      inboxOf({ target, config: readConfig(target) ?? {} })
        .items.filter((item) => item.kind === 'rebase')
        .map(({ target: on, changed }) => [on, changed]),
    ).toEqual([
      ['elements/hero', ['elements/hero']],
      ['pages/home', ['elements/hero']],
    ]);
  });
});
