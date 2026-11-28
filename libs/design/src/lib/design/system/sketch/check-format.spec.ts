import { spawnSync } from 'child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { formatProblemsOf, formatSketch } from './check-format';
import { changedSinceReadyOf, createSketch, markSketchReady, readSketch, Sketch } from './sketch';

const createdSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-check-format-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const created = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;

  return { target, created };
};

const readySketchWith = (sharedText: string) => {
  const { target, created } = createdSketch();

  formatSketch({ target, sketch: created, variants: created.variants });
  mkdirSync(join(created.dir, 'shared'), { recursive: true });
  writeFileSync(join(created.dir, 'shared/chrome.ts'), sharedText);

  const ready = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  return { target, ready };
};

describe('formatSketch on a ready sketch', () => {
  it('keeps the ready mark when the format pass only reformats', () => {
    const { target, ready } = readySketchWith('export const chrome   =  {a:1}\n');

    formatSketch({ target, sketch: ready, variants: ready.variants });

    expect(changedSinceReadyOf(readSketch({ product: 'acme', dir: ready.dir }) as Sketch)).toEqual([]);
  });

  it('still reports a variant edited after ready', () => {
    const { target, ready } = readySketchWith('export const chrome = { a: 1 };\n');

    writeFileSync(join(ready.dir, 'b/edited.ts'), 'export const edited   = 1\n');
    formatSketch({ target, sketch: ready, variants: ready.variants });

    expect(changedSinceReadyOf(readSketch({ product: 'acme', dir: ready.dir }) as Sketch)).toEqual(['b']);
  });
});

describe('the FORMAT rule', () => {
  it('skips and leaves alone the files git ignores', () => {
    const { target, created } = createdSketch();
    const ignored = join(created.dir, 'a/generated.json');
    const unformatted = '{"a":1}\n';

    formatSketch({ target, sketch: created, variants: created.variants });
    spawnSync('git', ['init', '-q'], { cwd: target });
    writeFileSync(join(created.dir, '.gitignore'), '*/generated.json\n');
    writeFileSync(ignored, unformatted);
    writeFileSync(join(created.dir, 'a/tracked.json'), unformatted);

    expect(formatProblemsOf({ target, sketch: created, variant: 'a' }).map((problem) => problem.file)).toEqual([
      join(created.dir, 'a/tracked.json'),
    ]);

    formatSketch({ target, sketch: created, variants: created.variants });

    expect(readFileSync(ignored, 'utf8')).toBe(unformatted);
    expect(readFileSync(join(created.dir, 'a/tracked.json'), 'utf8')).not.toBe(unformatted);
  });
});
