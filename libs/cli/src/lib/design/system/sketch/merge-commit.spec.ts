import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { gitResult } from '../git-repo.fixtures';
import { resolveProduct } from '../resolve-product';
import { mergeInWorker } from './merge-runner';
import { mergeAndRecord } from './merge-step';
import { createSketch, decideSketch, findSketch, markSketchReady, Sketch, SketchTarget } from './sketch';
import { originOf } from '../write-origin';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-commit-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  return target;
};

const gitOf =
  (target: string) =>
  (...args: string[]) =>
    gitResult(target, ...args);

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const pickedSketch = (target: string, sketch: SketchTarget, css: string) => {
  const created = createSketch({ product: productOf(target), sketch, variants: ['a', 'b'] }) as Sketch;

  writeFileSync(join(created.dir, 'b', sketch.layer, sketch.name, `${sketch.name}.css`), css);

  const ready = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  return decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'b', ...originOf('spec') } }) as Sketch;
};

const mergeOf = (target: string, sketch: Sketch) =>
  mergeAndRecord({ target, config: readConfig(target) ?? {}, product: productOf(target), sketch, note: 'Calmer.' });

describe('a merge commits its own result', { timeout: 120_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('commits each merge on its own and does not refuse a second merge in a row', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = gitOf(target);

    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );
    pickedSketch(target, { layer: 'pages', name: 'home' }, '.acme-home { color: var(--acme-accent); }');
    const stray = join(target, DESIGN_DIR, 'acme/foundations/palette/palette.css');

    writeFileSync(stray, '.acme-palette { margin: 0; }\n');

    expect(mergeOf(target, hero)).toMatchObject({ parts: ['elements/hero'] });
    const product = productOf(target);
    const rebased = findSketch({
      productDir: product.dir,
      product: product.name,
      sketch: { layer: 'pages', name: 'home' },
    }) as Sketch;

    expect(mergeOf(target, rebased)).toMatchObject({ parts: ['pages/home'] });

    const subjects = git('log', '--format=%s').stdout.trim().split('\n');

    expect(subjects).toEqual([
      'feat(repo): Merge pages/home variant b into acme',
      'feat(repo): Merge elements/hero variant b into acme',
      'base',
    ]);
    expect(git('show', '--name-only', '--format=', 'HEAD~1').stdout).toContain('acme/elements/hero/hero.css');
    expect(git('show', '--name-only', '--format=', 'HEAD~1').stdout).not.toContain('palette.css');
    expect(git('status', '--porcelain', '--', `${DESIGN_DIR}/acme/elements`, `${DESIGN_DIR}/acme/pages`).stdout).toBe(
      '',
    );
    expect(git('status', '--porcelain', '--', stray).stdout).toBe(
      ` M ${DESIGN_DIR}/acme/foundations/palette/palette.css\n`,
    );
    expect(existsSync(hero.dir)).toBe(false);
  });

  it('commits only its own entries of merged.json and leaves a foreign edit of it in the tree', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = gitOf(target);
    const merged = join(target, DESIGN_DIR, 'acme/merged.json');

    writeFileSync(merged, `${JSON.stringify({ 'pages/home': 'aaaaaaaaaaaaaaaa' }, null, 2)}\n`);
    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );

    writeFileSync(merged, `${JSON.stringify({ 'pages/home': 'bbbbbbbbbbbbbbbb' }, null, 2)}\n`);

    expect(mergeOf(target, hero)).toMatchObject({ parts: ['elements/hero'] });

    const committed = JSON.parse(git('show', `HEAD:${DESIGN_DIR}/acme/merged.json`).stdout);

    expect(committed['elements/hero']).toBeDefined();
    expect(committed['pages/home']).toBe('aaaaaaaaaaaaaaaa');
    expect(git('diff', '--', merged).stdout).toContain('bbbbbbbbbbbbbbbb');
  });

  it('carries a none changeset for the workspace package the merge changes', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = gitOf(target);

    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['.ethlete', 'libs/*'] }));
    writeFileSync(join(target, '.ethlete/package.json'), JSON.stringify({ name: 'acme-app' }));
    mkdirSync(join(target, '.changeset'));
    writeFileSync(join(target, '.changeset/config.json'), '{}');
    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );

    expect(mergeOf(target, hero)).toMatchObject({ parts: ['elements/hero'] });
    expect(git('show', '--name-only', '--format=', 'HEAD').stdout).toContain(
      '.changeset/design-merge-elements-hero-b.md',
    );
    expect(git('show', 'HEAD:.changeset/design-merge-elements-hero-b.md').stdout).toBe("---\n'acme-app': none\n---\n");
    expect(git('status', '--porcelain', '--', '.changeset').stdout).toBe('');
  });

  it('writes no changeset when the changed files lie in no workspace package', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const git = gitOf(target);

    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['libs/*'] }));
    mkdirSync(join(target, '.changeset'));
    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );

    expect(mergeOf(target, hero)).toMatchObject({ parts: ['elements/hero'] });
    expect(git('show', '--name-only', '--format=', 'HEAD').stdout).not.toContain('.changeset/');
  });

  it('leaves the files in place outside a git checkout', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const target = acme();
    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );

    expect(mergeOf(target, hero)).toMatchObject({ parts: ['elements/hero'] });
  });

  it('commits a Studio merge from the merge worker', async () => {
    const target = acme();
    const git = gitOf(target);

    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    const hero = pickedSketch(
      target,
      { layer: 'elements', name: 'hero' },
      '.acme-hero { background: var(--acme-accent); }',
    );

    expect(await mergeInWorker({ target, product: 'acme', sketch: hero })).toEqual(['elements/hero']);
    expect(git('log', '-1', '--format=%s').stdout.trim()).toBe('feat(repo): Merge elements/hero variant b into acme');
    expect(git('status', '--porcelain', '--', `${DESIGN_DIR}/acme/elements`).stdout).toBe('');
  });
});
