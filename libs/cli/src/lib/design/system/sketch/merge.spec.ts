import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { originOf } from '../write-origin';
import childProcess, { spawnSync } from 'child_process';
import { IncomingMessage } from 'http';
import { syncBuiltinESMExports } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { sketchMergeAnswer } from '../../studio-api';
import {
  addressComment,
  commentsOnSketch,
  CommentFile,
  createComment,
  DesignComment,
  replyToComment,
} from '../comments/comment';
import { resolveProduct } from '../resolve-product';
import { discardSketch, mergeSketch } from './merge';
import { changedOutsideSketchOf, readMergeDecision, readMerged, recordMerged } from './merged-parts';
import {
  createSketch,
  decideSketch,
  markSketchReady,
  rebaseSketch,
  reportSketch,
  Sketch,
  SketchMerge,
  sketchReportPath,
  SketchTarget,
} from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readySketch = (
  target: string,
  sketch: SketchTarget = { layer: 'elements', name: 'hero' },
  merge?: SketchMerge,
) => {
  const product = resolveAcme(target);
  const created = createSketch({ product, sketch, variants: ['a', 'b'], merge }) as Sketch;

  return { product, sketch: markSketchReady({ checkout: target, sketch: created }) as Sketch };
};

const picked = (sketch: Sketch, variant = 'b') =>
  decideSketch({ sketch, decision: { kind: 'pick', variant, ...originOf('spec') } }) as Sketch;

const reasonOf = (result: ReturnType<typeof mergeSketch>) => (Array.isArray(result) ? result : result.reason);

const mergeResult = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }) =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    product: resolveAcme(target),
    sketch: found.sketch,
    note: 'Variant b, because it is calmer.',
    replaceNote: true,
  });

const merge = (target: string, found: { product: ReturnType<typeof resolveAcme>; sketch: Sketch }) =>
  reasonOf(mergeResult(target, found));

const addressedOf = (comment: DesignComment) =>
  (JSON.parse(readFileSync(comment.file, 'utf8')) as CommentFile).addressed;

const resolvedOf = (comment: DesignComment) => (JSON.parse(readFileSync(comment.file, 'utf8')) as CommentFile).resolved;

const addressed = (product: ReturnType<typeof resolveAcme>, comment: DesignComment) =>
  addressComment({ products: [{ name: product.name, dir: product.dir }], id: comment.id, author: 'gpt-5.6-sol' });

const commentOn = (product: ReturnType<typeof resolveAcme>, sketch?: { target: string; variant: string }) =>
  createComment({
    product,
    comment: { part: 'elements/hero', state: 'default', size: 'phone', text: 'Bigger.', ...(sketch ? { sketch } : {}) },
  }) as DesignComment;

const agentReply = (product: ReturnType<typeof resolveAcme>, comment: DesignComment, text: string) =>
  replyToComment({
    products: [{ name: product.name, dir: product.dir }],
    id: comment.id,
    by: 'agent',
    author: 'gpt-5.6-sol',
    text,
  });
const heroOf = (target: string) => join(target, DESIGN_DIR, 'acme/elements/hero');

describe('mergeSketch', { timeout: 60_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('regenerates the stale harness map after a Studio merge', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const configFile = join(target, DESIGN_DIR, 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));
    const harness = { app: 'apps/app', map: 'apps/app/src/harness/parts.ts' };

    config.products.acme.harness = harness;
    writeFileSync(configFile, JSON.stringify(config));

    const ready = readySketch(target);

    picked(ready.sketch);

    const answer = await sketchMergeAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST' }) as unknown as IncomingMessage,
    });

    expect(answer.status).toBe(200);
    expect(readFileSync(join(target, harness.map), 'utf8')).toContain('DESIGN_HARNESS_PARTS');
  });

  it('runs a Studio merge without a child process', async () => {
    const target = acme();
    const ready = readySketch(target);

    picked(ready.sketch);

    const spawners = (['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const).map(
      (name) => vi.spyOn(childProcess, name),
    );

    syncBuiltinESMExports();

    const answer = await sketchMergeAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST' }) as unknown as IncomingMessage,
    });

    const spawned = spawners.filter((spy) => spy.mock.calls.length > 0).map((spy) => spy.getMockName());

    for (const spy of spawners) spy.mockRestore();
    syncBuiltinESMExports();

    expect(answer.status).toBe(200);
    expect(spawned).toEqual([]);
  });

  it('records the merged parts, so a later change outside a sketch shows', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);

    expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['elements/hero']);
    expect(Object.keys(readMerged(join(target, DESIGN_DIR, 'acme')))).toEqual(['elements/hero']);
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    writeFileSync(join(heroOf(target), 'hero.css'), '.acme-hero { padding: 0; }');

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['elements/hero']);
  });

  it('records the pick, who decided it and when, next to the hash, after the sketch is gone', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const sketch = picked(ready.sketch);
    const at = sketch.decision?.decidedAt;

    expect(merge(target, { ...ready, sketch })).toEqual(['elements/hero']);
    expect(existsSync(sketch.dir)).toBe(false);
    expect(readMergeDecision(join(target, DESIGN_DIR, 'acme'), 'elements/hero')).toEqual({
      variant: 'b',
      decidedBy: 'user',
      at,
    });
  });

  it('records who else decided the pick when the merge names them', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);

    mergeSketch({
      target,
      config: readConfig(target) ?? {},
      product: resolveAcme(target),
      sketch: picked(ready.sketch, 'a'),
      decidedBy: 'plan: B1',
    });

    expect(readMergeDecision(join(target, DESIGN_DIR, 'acme'), 'elements/hero')).toMatchObject({
      variant: 'a',
      decidedBy: 'plan: B1',
    });
  });

  it('refuses a merge without a recorded pick and writes no record', () => {
    const target = acme();
    const ready = readySketch(target);

    expect(merge(target, ready)).toContain('has no pick');
    expect(readMergeDecision(join(target, DESIGN_DIR, 'acme'), 'elements/hero')).toBeNull();
  });

  it('copies the variant over the product, sets the note, checks and deletes the sketch', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const product = resolveAcme(target);
    let drafted = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;
    const variantDir = join(drafted.dir, 'b');

    writeFileSync(join(variantDir, 'elements/hero/hero.css'), '.acme-hero { background: var(--acme-accent); }');
    mkdirSync(join(variantDir, 'components/card'), { recursive: true });
    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), join(variantDir, 'components/card'), {
      recursive: true,
    });
    drafted = reportSketch({
      checkout: target,
      sketch: drafted,
      variant: 'b',
      author: 'gpt-5.6-sol',
      message: 'phone',
    }) as Sketch;
    drafted = reportSketch({
      checkout: target,
      sketch: drafted,
      variant: 'b',
      author: 'claude-opus-5-5',
      message: 'phone',
    }) as Sketch;

    const found = {
      product,
      sketch: picked(markSketchReady({ checkout: target, sketch: drafted }) as Sketch),
    };

    expect(merge(target, found)).toEqual(['components/card', 'elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "madeBy: ['gpt-5.6-sol', 'claude-opus-5-5']",
    );
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toContain('--acme-accent');
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("note: 'Variant b, because it is calmer.'");
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/card/card.ts'))).toBe(false);
    expect(existsSync(join(target, DESIGN_DIR, 'acme-base/components/card/card.ts'))).toBe(true);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect(existsSync(sketchReportPath({ checkout: target, sketch: found.sketch }))).toBe(false);
  }, 120_000);

  it("keeps the target part's note when the merge gives a reason without replaceNote", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const merged = mergeSketch({
      target,
      config: readConfig(target) ?? {},
      product: resolveAcme(target),
      sketch: picked(ready.sketch),
      note: 'Variant b, because it is calmer.',
    });

    expect(reasonOf(merged)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "note: 'One featured film with its play button.'",
    );
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).not.toContain('calmer');
  }, 120_000);

  it('keeps the note and madeBy of the variant file without a note or authors, and adds new authors to madeBy', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const config = readConfig(target) ?? {};
    const heroFile = (dir: string) => join(dir, 'b/elements/hero/hero.ts');
    const mergeWithoutNote = (sketch: Sketch) =>
      reasonOf(mergeSketch({ target, config, product: resolveAcme(target), sketch: picked(sketch) }));
    const first = readySketch(target).sketch;

    writeFileSync(
      heroFile(first.dir),
      readFileSync(heroFile(first.dir), 'utf8').replace(
        "note: 'One featured film with its play button.',",
        "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol'],",
      ),
    );

    expect(mergeWithoutNote(first)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol'],",
    );

    const product = resolveAcme(target);
    const created = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
      author: 'claude-opus-5-5',
    }) as Sketch;

    expect(mergeWithoutNote(markSketchReady({ checkout: target, sketch: created }) as Sketch)).toEqual([
      'elements/hero',
    ]);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain(
      "note: 'Calm hero.',\n  madeBy: ['gpt-5.6-sol', 'claude-opus-5-5'],",
    );
  }, 240_000);

  it('gives a new part the picked variant note when the merge names none', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const created = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'badge' },
      variants: ['a', 'b'],
      variantNotes: new Map([['b', 'Round badge.']]),
    }) as Sketch;
    const sketch = picked(markSketchReady({ checkout: target, sketch: created }) as Sketch);

    expect(
      reasonOf(mergeSketch({ target, config: readConfig(target) ?? {}, product: resolveAcme(target), sketch })),
    ).toEqual(['elements/badge']);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/elements/badge/badge.ts'), 'utf8')).toContain(
      "note: 'Round badge.'",
    );
  }, 240_000);

  it('merges past a problem the product already had and prints it as a note', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();

    mkdirSync(join(target, DESIGN_DIR, 'acme/assets'), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'acme/assets/mark.svg'), '<svg viewBox="0 0 8 8"/>');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect([...log.mock.calls, ...warn.mock.calls].flat().join('\n')).toContain('SVG-ASSET');
  }, 240_000);

  it('puts the old files back and keeps the sketch when the check fails', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const before = readFileSync(join(heroOf(target), 'hero.ts'), 'utf8');

    writeFileSync(join(found.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { color: #fff; }');
    mkdirSync(join(found.sketch.dir, 'b/components/badge'), { recursive: true });
    writeFileSync(join(found.sketch.dir, 'b/components/badge/badge.ts'), 'export default 1;');

    const refused = mergeResult(target, found);

    expect(Array.isArray(refused) ? refused : refused.reason).toContain('the check failed');
    expect(Array.isArray(refused) ? [] : refused.findings).toContain(
      'HARD-CODED-COLOUR .ethlete/design/acme/elements/hero/hero.css: #fff outside foundations - use a foundations token',
    );
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toBe(before);
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).not.toContain('#fff');
    expect(existsSync(join(target, DESIGN_DIR, 'acme/components/badge'))).toBe(false);
    expect(existsSync(found.sketch.dir)).toBe(true);
  }, 120_000);

  const committed = (target: string) => {
    const git = (...args: string[]) =>
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

    git('init');
    git('add', '.');
    git('commit', '-m', 'base');

    return git;
  };

  it('checks in a clean copy of HEAD, so uncommitted edits outside the sketch neither block nor fail it', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = committed(target);
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const homeCss = join(target, DESIGN_DIR, 'acme/pages/home/home.css');
    const homeTs = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');
    const broken = `${readFileSync(homeTs, 'utf8')}\nexport const broken: number = 'x';\n`;
    const stray = join(target, DESIGN_DIR, 'acme/pages/home/stray.ts');

    writeFileSync(join(found.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { background: var(--acme-accent); }');
    writeFileSync(homeCss, '.acme-home { color: #fff; }');
    writeFileSync(homeTs, broken);
    writeFileSync(stray, 'export default 1;\n');

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toContain('--acme-accent');
    expect(readFileSync(homeCss, 'utf8')).toBe('.acme-home { color: #fff; }');
    expect(readFileSync(homeTs, 'utf8')).toBe(broken);
    expect(existsSync(stray)).toBe(true);
    expect(existsSync(found.sketch.dir)).toBe(false);
    expect(git('status', '--porcelain', '--', join(DESIGN_DIR, 'acme/elements')).stdout).toBe(
      ` M ${DESIGN_DIR}/acme/elements/hero/hero.css\n M ${DESIGN_DIR}/acme/elements/hero/hero.ts\n`,
    );
  }, 120_000);

  it('refuses before any write and names the uncommitted file the merge would overwrite', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();

    committed(target);

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const heroTs = join(heroOf(target), 'hero.ts');
    const edited = `${readFileSync(heroTs, 'utf8')}\nexport const edited = true;\n`;
    const cssBefore = readFileSync(join(heroOf(target), 'hero.css'), 'utf8');

    writeFileSync(join(found.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { background: var(--acme-accent); }');
    writeFileSync(heroTs, edited);
    writeFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.css'), '.acme-home { margin: 0; }');

    const result = mergeResult(target, found);

    expect(reasonOf(result)).toContain('would overwrite uncommitted edits');
    expect(Array.isArray(result) ? [] : result.dirty).toEqual([`${DESIGN_DIR}/acme/elements/hero/hero.ts`]);
    expect(readFileSync(heroTs, 'utf8')).toBe(edited);
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toBe(cssBefore);
    expect(existsSync(found.sketch.dir)).toBe(true);
  }, 120_000);

  it('merges while only a decision file of the product is uncommitted', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = (...args: string[]) =>
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

    git('init');
    git('add', '.');
    git('commit', '-m', 'base');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    writeFileSync(join(target, DESIGN_DIR, 'acme/go.json'), '{}\n');

    expect(merge(target, found)).toEqual(['elements/hero']);
  }, 120_000);

  it('names the file outside the sketch when the check fails on it', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const button = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');

    writeFileSync(button, `${readFileSync(button, 'utf8')}\nexport const broken: number = 'x';\n`);

    const result = mergeResult(target, found);
    const reason = reasonOf(result);

    expect(reason, JSON.stringify(Array.isArray(result) ? [] : result.findings)).toContain(
      'product broken outside this sketch',
    );
    expect(reason).toContain(join(DESIGN_DIR, 'acme/pages/home/home.ts'));
    expect(existsSync(found.sketch.dir)).toBe(true);
  }, 120_000);

  it('answers the check findings of a refused merge to Studio', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);

    picked(ready.sketch);
    writeFileSync(join(ready.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    const answer = await sketchMergeAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST' }) as unknown as IncomingMessage,
    });

    expect(answer.status).toBe(422);
    expect(answer.body).toEqual({
      error: expect.stringContaining('the check failed'),
      reason: 'check-failed',
      findings: [
        'HARD-CODED-COLOUR .ethlete/design/acme/elements/hero/hero.css: #fff outside foundations - use a foundations token',
      ],
    });
  }, 120_000);

  it('refuses before any write', () => {
    const target = acme();
    const product = resolveAcme(target);
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;
    const config = readConfig(target) ?? {};

    expect(reasonOf(mergeSketch({ target, config, product, sketch, note: 'x' }))).toBe(
      'elements/hero is in progress - mark it ready before a merge: design sketch ready elements/hero --by <model id> --product acme',
    );

    const ready = markSketchReady({ checkout: target, sketch }) as Sketch;

    expect(reasonOf(mergeSketch({ target, config, product, sketch: ready, note: 'x' }))).toBe(
      'elements/hero has no pick - the user picks a variant in Studio before a merge',
    );
    expect(
      reasonOf(mergeSketch({ target, config, product, sketch: { ...picked(ready, 'a'), variants: [] }, note: 'x' })),
    ).toContain('no variant "a", the one picked');
    expect(
      reasonOf(
        mergeSketch({
          target,
          config,
          product,
          sketch: { ...picked(ready, 'a'), rejections: { a: [{ by: 'agent', decidedAt: 'now', reason: 'flat' }] } },
          note: 'x',
        }),
      ),
    ).toBe('elements/hero variant a is rejected by the agent: flat - reopen it first');

    const card = createSketch({ product, sketch: { layer: 'components', name: 'card' }, variants: ['a'] }) as Sketch;

    writeFileSync(join(card.dir, 'a/components/card/card.ts'), 'export default 1;');
    expect(
      reasonOf(
        mergeSketch({
          target,
          config,
          product,
          sketch: picked(markSketchReady({ checkout: target, sketch: card }) as Sketch, 'a'),
          note: 'x',
          replaceNote: true,
        }),
      ),
    ).toContain("holds no definePart({ note: '…' })");
  });

  it('refuses when a part the variant replaces changed in the product, until the sketch is rebased', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    writeFileSync(join(heroOf(target), 'hero.css'), '.acme-hero { padding: 0; }');

    expect(mergeResult(target, found)).toEqual({
      reason:
        'elements/hero changed in the product since the sketch on elements/hero was created - bring variant "b" up to date, then run sketch rebase elements/hero',
      changed: ['elements/hero'],
    });
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toBe('.acme-hero { padding: 0; }');

    const rebased = rebaseSketch({ product: resolveAcme(target), sketch: found.sketch });

    expect(merge(target, { ...found, sketch: rebased })).toEqual(['elements/hero']);
  }, 120_000);

  it('refuses a sketch that records no baseline', () => {
    const target = acme();
    const ready = readySketch(target);
    const refused = mergeResult(target, { ...ready, sketch: { ...picked(ready.sketch), baseline: undefined } });

    expect(refused).toMatchObject({ changed: [] });
    expect(reasonOf(refused)).toContain('records no baseline of the product');
  });

  it('copies a target the product takes from its base into the product to carry the note with --override', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target, { layer: 'components', name: 'card' }, 'override');
    const found = { ...ready, sketch: picked(ready.sketch) };
    const variantDir = join(found.sketch.dir, 'b');

    rmSync(join(variantDir, 'components'), { recursive: true });
    cpSync(join(target, DESIGN_DIR, 'acme-base/foundations/tokens'), join(variantDir, 'foundations/tokens'), {
      recursive: true,
    });

    expect(merge(target, found)).toEqual(['components/card', 'foundations/tokens']);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/components/card/card.ts'), 'utf8')).toContain(
      "note: 'Variant b, because it is calmer.'",
    );
    expect(resolveAcme(target).parts.find((part) => part.name === 'card')?.origin).toBe('overridden');
  }, 120_000);

  it('marks the open comments on the sketch addressed and keeps those on the product part open', () => {
    const target = acme();
    const found = readySketch(target);
    const onSketch = commentOn(found.product, { target: 'elements/hero', variant: 'a' });
    const onPart = commentOn(found.product);

    agentReply(found.product, onSketch, 'Made it bigger.');

    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toEqual(['elements/hero']);
    expect(addressedOf(onSketch)).toMatchObject({ by: 'user', reason: 'merge' });
    expect(addressedOf(onPart)).toBeUndefined();
    expect(commentsOnSketch({ productDir: found.product.dir, product: 'acme', sketch: found.sketch })).toEqual([]);
  }, 120_000);

  it('keeps a thread on the sketch open that has no reply yet or whose last entry asks a question', () => {
    const target = acme();
    const found = readySketch(target);
    const sketchTarget = { target: 'elements/hero', variant: 'a' };
    const unanswered = commentOn(found.product, sketchTarget);
    const asked = commentOn(found.product, sketchTarget);
    const askedByFlag = commentOn(found.product, sketchTarget);

    agentReply(found.product, asked, 'Bigger how? ');
    replyToComment({
      products: [{ name: found.product.name, dir: found.product.dir }],
      id: askedByFlag.id,
      by: 'agent',
      author: 'gpt-5.6-sol',
      text: 'Which size do you mean.',
      question: true,
    });

    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toEqual(['elements/hero']);
    expect(addressedOf(unanswered)).toBeUndefined();
    expect(addressedOf(asked)).toBeUndefined();
    expect(addressedOf(askedByFlag)).toBeUndefined();
  }, 120_000);

  it('resolves the addressed comments on the sketch and on the merged part, and leaves the open ones addressed only', () => {
    const target = acme();
    const found = readySketch(target);
    const sketchTarget = { target: 'elements/hero', variant: 'a' };
    const addressedOnSketch = commentOn(found.product, sketchTarget);
    const openOnSketch = commentOn(found.product, sketchTarget);
    const addressedOnPart = commentOn(found.product);
    const addressedElsewhere = createComment({
      product: found.product,
      comment: { part: 'pages/home', state: 'empty', size: 'phone', text: 'Why empty?' },
    }) as DesignComment;

    addressed(found.product, addressedOnSketch);
    addressed(found.product, addressedOnPart);
    addressed(found.product, addressedElsewhere);
    agentReply(found.product, openOnSketch, 'Made it bigger.');

    expect(merge(target, { ...found, sketch: picked(found.sketch) })).toEqual(['elements/hero']);
    expect(resolvedOf(addressedOnSketch)).toMatchObject({
      by: 'user',
      note: 'resolved by the merge of elements/hero variant b',
    });
    expect(resolvedOf(addressedOnPart)).toMatchObject({ note: 'resolved by the merge of elements/hero variant b' });
    expect(resolvedOf(openOnSketch)).toBeUndefined();
    expect(addressedOf(openOnSketch)).toMatchObject({ reason: 'merge' });
    expect(resolvedOf(addressedElsewhere)).toBeUndefined();
  }, 120_000);
});

describe('mergeSketch with assets', () => {
  afterEach(() => vi.restoreAllMocks());

  it("copies the variant's assets into the product's, keeps the others and records the hash with them", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const assets = join(target, DESIGN_DIR, 'acme/assets');

    mkdirSync(assets);
    writeFileSync(join(assets, 'mark.png'), 'old');
    writeFileSync(join(assets, 'keep.png'), 'keep');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const variant = join(found.sketch.dir, 'b');
    const hero = join(variant, 'elements/hero/hero.ts');

    mkdirSync(join(variant, 'assets/icons'), { recursive: true });
    writeFileSync(join(variant, 'assets/mark.png'), 'new');
    writeFileSync(join(variant, 'assets/icons/dot.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(
      hero,
      `import mark from '@assets/mark.png';\n${readFileSync(hero, 'utf8')}\nexport const url = mark;\n`,
    );

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(readFileSync(join(assets, 'mark.png'), 'utf8')).toBe('new');
    expect(readFileSync(join(assets, 'icons/dot.svg'), 'utf8')).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(readFileSync(join(assets, 'keep.png'), 'utf8')).toBe('keep');
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    writeFileSync(join(assets, 'mark.png'), 'newer');

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['elements/hero']);
  }, 120_000);
});

describe('mergeSketch with an asset another part uses', () => {
  afterEach(() => vi.restoreAllMocks());

  const withDependents = (options: { foreignEdit: boolean }) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const target = acme();
    const assets = join(target, DESIGN_DIR, 'acme/assets');
    const home = join(target, DESIGN_DIR, 'acme/pages/home');
    const homeFile = join(home, 'home.ts');

    mkdirSync(assets);
    writeFileSync(join(assets, 'mark.png'), 'old');
    writeFileSync(
      homeFile,
      `import mark from '@assets/mark.png';\n${readFileSync(homeFile, 'utf8')}\nexport const m = mark;\n`,
    );
    recordMerged({ product: resolveAcme(target), parts: ['pages/home'] });

    if (options.foreignEdit) writeFileSync(join(home, 'home.css'), '.acme-home { margin: 0; }');

    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };

    mkdirSync(join(found.sketch.dir, 'b/assets'), { recursive: true });
    writeFileSync(join(found.sketch.dir, 'b/assets/mark.png'), 'new');

    expect(merge(target, found)).toEqual(['elements/hero']);

    return { target, log };
  };

  it('re-records the hash of a part that uses the changed asset, and lists it', () => {
    const { target, log } = withDependents({ foreignEdit: false });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
    expect(log).toHaveBeenCalledWith('Asset or shared/ change also updates: pages/home');
  }, 120_000);

  it('keeps a part with a foreign edit before the merge showing as changed outside a sketch', () => {
    const { target, log } = withDependents({ foreignEdit: true });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['pages/home']);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('change also updates'));
  }, 120_000);
});

describe('mergeSketch with a shared folder', () => {
  afterEach(() => vi.restoreAllMocks());

  const withShared = (target: string) => {
    const ready = readySketch(target);
    const found = { ...ready, sketch: picked(ready.sketch) };
    const hero = join(found.sketch.dir, 'b/elements/hero/hero.ts');

    mkdirSync(join(found.sketch.dir, 'shared'));
    writeFileSync(join(found.sketch.dir, 'shared/data.ts'), "export { more as data } from '@shared/more';\n");
    writeFileSync(join(found.sketch.dir, 'shared/more.ts'), 'export const more = 1;\n');
    writeFileSync(
      hero,
      `import { data } from '@shared/data';\n${readFileSync(hero, 'utf8')}\nexport const shared = data;\n`,
    );

    return found;
  };

  it("moves the sketch's shared folder into the target and makes its imports relative", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();

    expect(merge(target, withShared(target))).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("from './shared/data'");
    expect(readFileSync(join(heroOf(target), 'shared/data.ts'), 'utf8')).toContain("from './more'");
    expect(existsSync(join(heroOf(target), 'shared/more.ts'))).toBe(true);
  }, 120_000);

  it('formats merged part and carried shared files using the product configuration', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = acme();
    const found = withShared(target);

    writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true, "semi": false }');
    writeFileSync(join(found.sketch.dir, 'shared/more.ts'), 'export const more=1;\n');
    writeFileSync(join(found.sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero{gap:1rem}');
    writeFileSync(join(found.sketch.dir, 'b/elements/hero/unformatted.unknown'), 'unchanged');

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'shared/more.ts'), 'utf8')).toBe('export const more = 1\n');
    expect(readFileSync(join(heroOf(target), 'hero.css'), 'utf8')).toBe('.acme-hero {\n  gap: 1rem;\n}\n');
    expect(readFileSync(join(heroOf(target), 'unformatted.unknown'), 'utf8')).toBe('unchanged');
    expect(warning.mock.calls.flat().join('\n')).not.toContain('Could not format');
  }, 120_000);

  it('keeps the merge when formatting fails and skips files without a parser', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = acme();
    const found = withShared(target);

    writeFileSync(join(found.sketch.dir, 'b/elements/hero/unformatted.unknown'), 'unchanged');
    writeFileSync(join(target, '.prettierrc'), '{ invalid');

    expect(merge(target, found)).toEqual(['elements/hero']);
    expect(readFileSync(join(heroOf(target), 'unformatted.unknown'), 'utf8')).toBe('unchanged');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Could not format'));
  }, 120_000);

  it('refuses when a part other than the target imports @shared/', () => {
    const target = acme();
    const found = withShared(target);
    const card = join(found.sketch.dir, 'b/components/card');

    cpSync(join(target, DESIGN_DIR, 'acme-base/components/card'), card, { recursive: true });
    writeFileSync(join(card, 'card.ts'), `import '@shared/more';\n${readFileSync(join(card, 'card.ts'), 'utf8')}`);

    expect(merge(target, found)).toContain('components/card import @shared/');
    expect(existsSync(join(heroOf(target), 'shared'))).toBe(false);
    expect(existsSync(found.sketch.dir)).toBe(true);
  });
});

describe('mergeSketch of a part that imports a file outside its folder', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rewrites the import back so it reaches the same file from the target', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const configFile = join(target, DESIGN_DIR, 'config.json');
    const config = JSON.parse(readFileSync(configFile, 'utf8'));
    const hero = join(heroOf(target), 'hero.ts');
    const specifier = '../../../../../apps/app/logos';

    config.products.acme.harness = { app: 'apps/app', map: 'apps/app/parts.ts', shared: ['apps/app/logos.ts'] };
    writeFileSync(configFile, JSON.stringify(config));
    mkdirSync(join(target, 'apps/app'), { recursive: true });
    writeFileSync(join(target, 'apps/app/logos.ts'), "export const logo = 'logo';\n");
    writeFileSync(
      hero,
      `import { logo } from '${specifier}';\n${readFileSync(hero, 'utf8')}\nexport const heroLogo = logo;\n`,
    );

    const ready = readySketch(target);

    expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['elements/hero']);
    expect(readFileSync(hero, 'utf8')).toContain(`from '${specifier}'`);
  }, 120_000);
});

describe('a part round trip through new, check and ready, per import form', () => {
  afterEach(() => vi.restoreAllMocks());

  const forms: Record<string, { line: string; files?: Record<string, string> }> = {
    'an @shared alias of the part shared folder': {
      line: "import { shared } from './shared/util';",
      files: { 'shared/util.ts': 'export const shared = 1;\n' },
    },
    'a relative import inside the part': {
      line: "import { inside } from './inside';",
      files: { 'inside.ts': 'export const inside = 1;\n' },
    },
    'a relative import to another part': {
      line: "import otherButton from '../../components/button/button';\nexport const other = otherButton;",
    },
    'a relative import out of the design tree': {
      line: "import { logo } from '../../../../../apps/app/logos';",
      files: { '../../../../../../apps/app/logos.ts': "export const logo = 'logo';\n" },
    },
    'an import type': { line: "import type { Film as Shape } from '@system/fixtures';" },
    'a re-export': { line: "export { logo as reLogo } from '../../../../../apps/app/logos';" },
    'a dynamic import': { line: "export const later = () => import('../../../../../apps/app/logos');" },
  };

  it.each(Object.entries(forms))(
    'keeps the part unchanged with %s',
    (_name, form) => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const target = acme();
      const configFile = join(target, DESIGN_DIR, 'config.json');
      const config = JSON.parse(readFileSync(configFile, 'utf8'));
      const hero = join(heroOf(target), 'hero.ts');

      config.products.acme.harness = { app: 'apps/app', map: 'apps/app/parts.ts', shared: ['apps/app/logos.ts'] };
      writeFileSync(configFile, JSON.stringify(config));
      mkdirSync(join(target, 'apps/app'), { recursive: true });
      writeFileSync(join(target, 'apps/app/logos.ts'), "export const logo = 'logo';\n");

      for (const [path, body] of Object.entries(form.files ?? {})) {
        if (path.startsWith('..')) continue;

        mkdirSync(join(heroOf(target), path, '..'), { recursive: true });
        writeFileSync(join(heroOf(target), path), body);
      }

      writeFileSync(hero, `${form.line}\n${readFileSync(hero, 'utf8')}`);

      const original = new Map(
        readdirSync(heroOf(target), { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => [
            join(entry.parentPath, entry.name),
            readFileSync(join(entry.parentPath, entry.name), 'utf8'),
          ]),
      );
      const ready = readySketch(target);

      expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['elements/hero']);

      const merged = new Map(
        readdirSync(heroOf(target), { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => [
            join(entry.parentPath, entry.name),
            readFileSync(join(entry.parentPath, entry.name), 'utf8'),
          ]),
      );

      expect([...merged.keys()].sort()).toEqual([...original.keys()].sort());

      for (const [path, source] of original)
        expect(merged.get(path)?.replace(/note: '[^']*'/u, 'N')).toBe(source.replace(/note: '[^']*'/u, 'N'));
    },
    120_000,
  );
});

describe('mergeSketch of a base part', () => {
  afterEach(() => vi.restoreAllMocks());

  const base = (target: string, path: string) => join(target, DESIGN_DIR, 'acme-base', path);
  const own = (target: string, path: string) => join(target, DESIGN_DIR, 'acme', path);

  it('merges into the base by default and records it in the base merged.json', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const ready = readySketch(target, { layer: 'components', name: 'card' });

    expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['components/card']);
    expect(readFileSync(base(target, 'components/card/card.ts'), 'utf8')).toContain(
      "note: 'Variant b, because it is calmer.'",
    );
    expect(existsSync(own(target, 'components/card'))).toBe(false);
    expect(Object.keys(readMerged(join(target, DESIGN_DIR, 'acme-base')))).toEqual(['components/card']);
    expect(readMerged(join(target, DESIGN_DIR, 'acme'))['components/card']).toBeUndefined();
  }, 120_000);

  it('with --into-base starts from the product copy, merges it into the base and removes the copy', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const copy = readFileSync(own(target, 'components/button/button.css'), 'utf8');

    recordMerged({ product: resolveAcme(target), parts: ['components/button'] });

    const ready = readySketch(target, { layer: 'components', name: 'button' }, 'into-base');

    expect(readFileSync(join(ready.sketch.dir, 'b/components/button/button.css'), 'utf8')).toBe(copy);
    expect(merge(target, { ...ready, sketch: picked(ready.sketch) })).toEqual(['components/button']);
    expect(existsSync(own(target, 'components/button'))).toBe(false);
    expect(readFileSync(base(target, 'components/button/button.css'), 'utf8')).toBe(copy);
    expect(readMerged(join(target, DESIGN_DIR, 'acme'))['components/button']).toBeUndefined();
    expect(readMerged(join(target, DESIGN_DIR, 'acme-base'))['components/button']).toBeDefined();
    expect(resolveAcme(target).parts.find((part) => part.name === 'button')?.origin).toBe('base');
  }, 120_000);
});

describe('mergeSketch with several targets', () => {
  afterEach(() => vi.restoreAllMocks());

  const readyOnTwo = (target: string) => {
    const product = resolveAcme(target);
    const created = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      others: [{ layer: 'components', name: 'card' }],
      variants: ['a', 'b'],
      author: 'claude-opus-5-5',
    }) as Sketch;

    return { product, sketch: picked(markSketchReady({ checkout: target, sketch: created }) as Sketch) };
  };

  it('merges every target in one go, each with the note and the authors', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const card = join(target, DESIGN_DIR, 'acme-base/components/card/card.ts');

    expect(merge(target, readyOnTwo(target))).toEqual(['components/card', 'elements/hero']);

    for (const file of [join(heroOf(target), 'hero.ts'), card]) {
      expect(readFileSync(file, 'utf8')).toContain("note: 'Variant b, because it is calmer.'");
      expect(readFileSync(file, 'utf8')).toContain("madeBy: ['claude-opus-5-5']");
    }
  }, 120_000);

  it("carries the sketch's shared folder into each target that imports it", () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const found = readyOnTwo(target);
    const cardDir = join(target, DESIGN_DIR, 'acme-base/components/card');

    mkdirSync(join(found.sketch.dir, 'shared'));
    writeFileSync(join(found.sketch.dir, 'shared/more.ts'), 'export const more = 1;\n');

    for (const file of ['b/elements/hero/hero.ts', 'b/components/card/card.ts'].map((path) =>
      join(found.sketch.dir, path),
    ))
      writeFileSync(
        file,
        `import { more } from '@shared/more';\n${readFileSync(file, 'utf8')}\nexport const shared = more;\n`,
      );

    expect(merge(target, found)).toEqual(['components/card', 'elements/hero']);
    expect(readFileSync(join(heroOf(target), 'hero.ts'), 'utf8')).toContain("from './shared/more'");
    expect(readFileSync(join(cardDir, 'card.ts'), 'utf8')).toContain("from './shared/more'");
    expect(existsSync(join(cardDir, 'shared/more.ts'))).toBe(true);
  }, 120_000);
});

describe('discardSketch', () => {
  it('deletes the sketch with its variants', () => {
    const target = acme();
    const { sketch } = readySketch(target);

    expect(discardSketch({ target, sketch })).toBeNull();
    expect(existsSync(sketch.dir)).toBe(false);
    expect(existsSync(join(heroOf(target), 'hero.ts'))).toBe(true);
  });

  it('marks the open comments on the sketch addressed and keeps those on the product part open', () => {
    const target = acme();
    const { product, sketch } = readySketch(target);
    const onSketch = commentOn(product, { target: 'elements/hero', variant: 'b' });
    const onPart = commentOn(product);

    expect(discardSketch({ target, sketch, author: 'gpt-5.6-sol' })).toBeNull();
    expect(existsSync(sketch.dir)).toBe(false);
    expect(addressedOf(onSketch)).toMatchObject({ by: 'agent', author: 'gpt-5.6-sol', reason: 'discard' });
    expect(addressedOf(onPart)).toBeUndefined();
  });

  it('resolves the addressed comments on the sketch and leaves the open ones addressed only', () => {
    const target = acme();
    const { product, sketch } = readySketch(target);
    const addressedOnSketch = commentOn(product, { target: 'elements/hero', variant: 'b' });
    const openOnSketch = commentOn(product, { target: 'elements/hero', variant: 'a' });
    const addressedOnPart = commentOn(product);

    addressed(product, addressedOnSketch);
    addressed(product, addressedOnPart);

    expect(discardSketch({ target, sketch })).toBeNull();
    expect(resolvedOf(addressedOnSketch)).toMatchObject({
      by: 'user',
      note: 'resolved by the discard of elements/hero',
    });
    expect(resolvedOf(openOnSketch)).toBeUndefined();
    expect(addressedOf(openOnSketch)).toMatchObject({ reason: 'discard' });
    expect(resolvedOf(addressedOnPart)).toBeUndefined();
  });
});
