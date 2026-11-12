import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { gitSpawn } from '../../../git-test-env.fixtures';
import { resolveProduct } from '../resolve-product';
import { mergeAndRecord, mergeStepOf } from './merge-step';
import { createSketch, markSketchReady, Sketch } from './sketch';

const BY = 'claude-opus-5-5';

const acmeOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readyOn = (options: { variants: string[]; sketch?: string }) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-pick-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  const git = (...args: string[]) =>
    gitSpawn(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

  git('init');
  git('add', '.');
  git('commit', '-m', 'base');

  const hero = join(target, DESIGN_DIR, 'acme/elements/hero');

  writeFileSync(join(hero, 'hero.css'), '.acme-hero { padding: 0; }\n');

  const created = createSketch({
    product: acmeOf(target),
    sketch: { layer: 'elements', name: 'hero', sketch: options.sketch },
    variants: options.variants,
  }) as Sketch;
  const sketch = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  return { target, sketch, hero, git };
};

const decisionOf = (sketch: Sketch) =>
  (JSON.parse(readFileSync(join(sketch.dir, 'sketch.json'), 'utf8')) as { decision?: unknown }).decision;

describe('merge --allowed-by that is refused', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves no agent pick in the sketch file', () => {
    const { target, sketch } = readyOn({ variants: ['a'] });
    const result = mergeAndRecord({
      target,
      config: readConfig(target) ?? {},
      product: acmeOf(target),
      sketch,
      by: BY,
      allowed: { variant: 'a', planRef: 'plans/x.md' },
    });

    expect(result).toContain('holds uncommitted changes');
    expect(decisionOf(sketch)).toBeUndefined();
  });

  it('lets a later merge entry for another variant merge that variant', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { target, sketch, hero, git } = readyOn({ variants: ['a', 'b'], sketch: 'edit' });
    const heroTs = join(hero, 'hero.ts');

    git('commit', '-m', 'hero', '--', join(hero, 'hero.css'));
    writeFileSync(join(sketch.dir, 'a', 'elements/hero/hero.css'), '.acme-hero { margin: 0; }\n');
    writeFileSync(heroTs, `${readFileSync(heroTs, 'utf8')}\nexport const edited = true;\n`);

    const stepOf = (variant: string) =>
      mergeStepOf({ target, product: 'acme', part: 'elements/hero@edit', variant, note: 'Impl Q12', by: BY });
    const refused = stepOf('a');

    if (typeof refused === 'string') throw new Error(refused);

    expect(await refused.run()).toBe(1);

    git('checkout', '--', heroTs);

    const step = stepOf('b');

    if (typeof step === 'string') throw new Error(step);

    expect(await step.run()).toBe(0);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining(`merged ${sketch.target} variant b`));
  });
});
