import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { gitSpawn } from '../../../git-test-env.fixtures';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { mergeSketch } from './merge';
import { mergeStepOf } from './merge-step';
import { portBaseChanges } from './rebase-port';
import { createSketch, decideSketch, markSketchReady, rebaseSketch, Sketch } from './sketch';

const HERO = 'elements/hero';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-remedy-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const heroOf = (target: string) => join(target, DESIGN_DIR, 'acme', HERO);

const gitOf =
  (target: string) =>
  (...args: string[]) =>
    gitSpawn(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

const committed = (target: string) => {
  const git = gitOf(target);

  git('init');
  git('add', '.');
  git('commit', '-m', 'base');

  return git;
};

const created = (target: string, variants = ['a', 'b']) =>
  createSketch({ product: resolveAcme(target), sketch: { layer: 'elements', name: 'hero' }, variants }) as Sketch;

const ready = (target: string, sketch: Sketch) => markSketchReady({ checkout: target, sketch }) as Sketch;

const picked = (sketch: Sketch, variant = 'b') =>
  decideSketch({ sketch, decision: { kind: 'pick', variant, ...originOf('spec') } }) as Sketch;

const merged = (target: string, sketch: Sketch) =>
  mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch, note: 'n' });

const reasonOf = (result: ReturnType<typeof mergeSketch>) => (Array.isArray(result) ? result : result.reason);

const rebased = (target: string, sketch: Sketch) => {
  expect(portBaseChanges({ target, product: resolveAcme(target), sketch }).conflicts).toEqual([]);

  return rebaseSketch({ product: resolveAcme(target), sketch });
};

const restyled = (sketch: Sketch, variant = 'b') =>
  writeFileSync(join(sketch.dir, variant, HERO, 'hero.css'), '.acme-hero { background: var(--acme-accent); }');

describe('each merge refusal that names a remedy merges once the remedy is applied', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  const quiet = () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  };

  it('not ready: merges after the sketch is marked ready', () => {
    quiet();

    const target = acme();
    const open = created(target);

    expect(reasonOf(merged(target, open))).toBe(
      `${HERO} is in progress - mark it ready before a merge: design sketch ready ${HERO} --by <model id> --product acme`,
    );
    expect(merged(target, picked(ready(target, open)))).toEqual([HERO]);
  });

  it('no pick: merges after the user picks a variant', () => {
    quiet();

    const target = acme();
    const sketch = ready(target, created(target));

    expect(reasonOf(merged(target, sketch))).toBe(
      `${HERO} has no pick - the user picks a variant in Studio before a merge`,
    );
    expect(merged(target, picked(sketch))).toEqual([HERO]);
  });

  it('rejected pick: merges after the variant is reopened', () => {
    quiet();

    const target = acme();
    const pick = picked(ready(target, created(target)));
    const rejected = {
      ...(decideSketch({
        sketch: pick,
        decision: { kind: 'reject', variant: 'b', reason: 'flat', by: 'agent' },
      }) as Sketch),
      decision: pick.decision,
    };

    expect(reasonOf(merged(target, rejected))).toBe(
      `${HERO} variant b is rejected by the agent: flat - reopen it first`,
    );

    const reopened = decideSketch({
      sketch: rejected,
      decision: { kind: 'reopen', variant: 'b', by: 'agent' },
    }) as Sketch;

    expect(merged(target, reopened)).toEqual([HERO]);
  });

  it('no baseline: merges after sketch rebase', () => {
    quiet();

    const target = acme();
    const sketch = { ...picked(ready(target, created(target))), baseline: undefined };

    expect(reasonOf(merged(target, sketch))).toBe(
      `${HERO} records no baseline of the product - compare each variant with the product, then run sketch rebase ${HERO}`,
    );
    expect(merged(target, rebased(target, sketch))).toEqual([HERO]);
  });

  it('changed part: merges after the change is ported and the sketch rebased', () => {
    quiet();

    const target = acme();
    const git = committed(target);
    const sketch = picked(ready(target, created(target)));
    const heroTs = join(heroOf(target), 'hero.ts');

    writeFileSync(heroTs, `${readFileSync(heroTs, 'utf8')}\nexport const changed = true;\n`);
    git('commit', '-m', 'change', '--', heroTs);

    expect(reasonOf(merged(target, sketch))).toBe(
      `${HERO} changed in the product since the sketch on ${HERO} was created - bring variant "b" up to date, then run sketch rebase ${HERO}`,
    );
    expect(merged(target, rebased(target, sketch))).toEqual([HERO]);
    expect(readFileSync(heroTs, 'utf8')).toContain('export const changed = true;');
  });

  it('uncommitted drawn-on part: merges after the part is committed', () => {
    quiet();

    const target = acme();
    const git = committed(target);
    const css = join(heroOf(target), 'hero.css');

    writeFileSync(css, '.acme-hero { padding: 0; }\n');

    const sketch = picked(ready(target, created(target)));

    expect(merged(target, sketch)).toEqual({
      reason: `${HERO} holds uncommitted changes that ${HERO} was drawn on, and a merge checks against HEAD - commit ${HERO} first, then merge ${HERO}`,
      changed: [HERO],
    });

    git('commit', '-m', 'hero', '--', css);

    expect(merged(target, sketch)).toEqual([HERO]);
  });

  it('uncommitted edit in the way: merges after it is reverted', () => {
    quiet();

    const target = acme();
    const git = committed(target);
    const sketch = picked(ready(target, created(target)));
    const heroTs = join(heroOf(target), 'hero.ts');

    restyled(sketch);
    writeFileSync(heroTs, `${readFileSync(heroTs, 'utf8')}\nexport const edited = true;\n`);

    expect(reasonOf(merged(target, sketch))).toBe(
      `the merge of ${HERO} would overwrite uncommitted edits - commit or revert them first: ${DESIGN_DIR}/acme/${HERO}/hero.ts`,
    );

    git('checkout', '--', heroTs);

    expect(merged(target, sketch)).toEqual([HERO]);
  });

  it('uncommitted edit in the way: merges after it is committed, then ported by sketch rebase', () => {
    quiet();

    const target = acme();
    const git = committed(target);
    const sketch = picked(ready(target, created(target)));
    const heroTs = join(heroOf(target), 'hero.ts');

    restyled(sketch);
    writeFileSync(heroTs, `${readFileSync(heroTs, 'utf8')}\nexport const edited = true;\n`);

    expect(reasonOf(merged(target, sketch))).toContain('commit or revert them first');

    git('commit', '-m', 'edit', '--', heroTs);

    expect(reasonOf(merged(target, sketch))).toBe(
      `${HERO} changed in the product since the sketch on ${HERO} was created - bring variant "b" up to date, then run sketch rebase ${HERO}`,
    );
    expect(merged(target, rebased(target, sketch))).toEqual([HERO]);
    expect(readFileSync(heroTs, 'utf8')).toContain('export const edited = true;');
  });

  it('product not in the committed config.json: merges after config.json is committed', () => {
    quiet();

    const target = acme();
    const configFile = join(target, DESIGN_DIR, 'config.json');
    const config = readFileSync(configFile, 'utf8');
    const withoutAcme = JSON.parse(config) as { products: Record<string, unknown> };

    delete withoutAcme.products['acme'];
    writeFileSync(configFile, JSON.stringify(withoutAcme));

    const git = committed(target);

    writeFileSync(configFile, config);

    const sketch = picked(ready(target, created(target)));

    expect(reasonOf(merged(target, sketch))).toBe(
      'acme is not in the committed config.json - commit it before a merge',
    );

    git('commit', '-m', 'config', '--', configFile);

    expect(merged(target, sketch)).toEqual([HERO]);
  });

  it('another part imports @shared/: merges after that code moves into the part', () => {
    quiet();

    const target = acme();
    const sketch = picked(ready(target, created(target)));
    const card = join(sketch.dir, 'b/components/card');

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/more.ts'), 'export const more = 1;\n');
    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), card, { recursive: true });

    const cardSource = readFileSync(join(card, 'card.ts'), 'utf8');

    writeFileSync(join(card, 'card.ts'), `import '@shared/more';\n${cardSource}`);

    expect(reasonOf(merged(target, sketch))).toBe(
      `components/card import @shared/ - only ${HERO} takes the sketch's shared/ into the product; move that code into the part`,
    );

    writeFileSync(join(card, 'more.ts'), 'export const more = 1;\n');
    writeFileSync(join(card, 'card.ts'), `import './more';\n${cardSource}`);

    expect(merged(target, sketch)).toEqual(expect.arrayContaining([HERO, 'components/card']));
  });

  it('merge entry without a pick: merges after the entry names the variant', async () => {
    quiet();

    const target = acme();

    ready(target, created(target, ['a']));

    const stepOf = (variant?: string) =>
      mergeStepOf({ target, part: HERO, product: 'acme', note: 'n', variant, by: 'claude-opus-5-5' });

    expect(stepOf()).toBe(`${HERO} has no pick - name the variant in the entry, or the user picks in Studio`);

    const step = stepOf('a');

    if (typeof step === 'string') throw new Error(step);

    expect(await step.run()).toBe(0);
  });

  it('merge entry on a sketch that is not ready: merges after the sketch is marked ready', async () => {
    quiet();

    const target = acme();
    const open = created(target, ['a']);
    const stepOf = () =>
      mergeStepOf({ target, part: HERO, product: 'acme', note: 'n', variant: 'a', by: 'claude-opus-5-5' });

    expect(stepOf()).toBe(
      `${HERO} is in progress - mark it ready first: design sketch ready ${HERO} --by <model id> --product acme`,
    );

    ready(target, open);

    const step = stepOf();

    if (typeof step === 'string') throw new Error(step);

    expect(await step.run()).toBe(0);
  });

  it('merge entry naming one of two live variants: merges after the user picks', async () => {
    quiet();

    const target = acme();
    const sketch = ready(target, created(target));
    const stepOf = () =>
      mergeStepOf({ target, part: HERO, product: 'acme', note: 'n', variant: 'a', by: 'claude-opus-5-5' });

    expect(stepOf()).toBe(`${HERO} has 2 live variants (a, b), not only "a" - the user picks in Studio`);

    picked(sketch, 'a');

    const step = stepOf();

    if (typeof step === 'string') throw new Error(step);

    expect(await step.run()).toBe(0);
  });
});
