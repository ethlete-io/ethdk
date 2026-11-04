import { execFileSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { baselineOf } from './baseline';
import { mergeSketch } from './merge';
import { createSketch, decideSketch, markSketchReady, readSketch, Sketch, SketchTarget } from './sketch';

const targets: string[] = [];

const git = (target: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: target,
    stdio: 'pipe',
  });

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-after-merge-'));

  targets.push(target);
  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');
  git(target, 'init', '-q');
  git(target, 'add', '-A');
  git(target, 'commit', '-qm', 'base');

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const readyOn = (target: string, sketch: SketchTarget) =>
  markSketchReady({
    checkout: target,
    sketch: createSketch({ product: resolveAcme(target), sketch, variants: ['a'] }) as Sketch,
  }) as Sketch;

const heroFile = (sketch: Sketch) => join(sketch.dir, 'a', 'elements/hero/hero.ts');

const edit = (file: string, from: string, to: string) =>
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));

const reread = (sketch: Sketch) => readSketch({ product: 'acme', dir: sketch.dir }) as Sketch;

const output = () => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

  return lines;
};

const mergeHero = (target: string, hero: Sketch) =>
  mergeSketch({
    target,
    config: readConfig(target) ?? {},
    product: resolveAcme(target),
    sketch: decideSketch({ sketch: hero, decision: { kind: 'pick', variant: 'a' } }) as Sketch,
  });

afterEach(() => {
  vi.restoreAllMocks();
  targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
});

describe('a merge and the other open sketches', { timeout: 120_000 }, () => {
  it('rebases an open sketch that embeds the merged part and keeps it ready', () => {
    const target = acme();
    const lines = output();
    const home = readyOn(target, { layer: 'pages', name: 'home' });
    const hero = readyOn(target, { layer: 'elements', name: 'hero' });

    edit(heroFile(hero), 'One featured film', 'The featured film');

    expect(mergeHero(target, hero)).toEqual(['elements/hero']);

    const after = reread(home);

    expect(after.baseline).toEqual(baselineOf(resolveAcme(target)));
    expect(after.status).toBe('ready');
    expect(after.portAfterMerge).toBeUndefined();
    expect(lines).toContain('REBASED acme pages/home after the merge of elements/hero');
  });

  it('marks an open sketch whose rebase conflicts for its agent and names it in the merge output', () => {
    const target = acme();
    const lines = output();
    const other = readyOn(target, { layer: 'elements', name: 'hero', sketch: 'other' });
    const hero = readyOn(target, { layer: 'elements', name: 'hero' });

    edit(heroFile(other), 'One featured film', 'A featured film');
    edit(heroFile(hero), 'One featured film', 'The featured film');

    expect(mergeHero(target, hero)).toEqual(['elements/hero']);

    const after = reread(other);

    expect(after.status).toBe('ready');
    expect(after.portAfterMerge?.merged).toEqual(['elements/hero']);
    expect(after.portAfterMerge?.reasons).toEqual([
      'a: elements/hero/hero.ts - the variant and the product both changed it',
    ]);
    expect(readFileSync(heroFile(other), 'utf8')).toContain('A featured film');
    expect(lines).toContain(
      'AGENT PORTS acme elements/hero@other after the merge of elements/hero: a: elements/hero/hero.ts - the variant and the product both changed it - port it by hand, then run sketch rebase elements/hero@other --product acme --by <model id>',
    );
  });
});
