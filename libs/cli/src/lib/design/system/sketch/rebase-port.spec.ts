import { execFileSync } from 'child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { portBaseChanges } from './rebase-port';
import { createSketch, Sketch } from './sketch';

const targets: string[] = [];

const git = (target: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: target,
    stdio: 'pipe',
  });

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const heroDir = (target: string) => join(target, '.ethlete/design/acme/elements/hero');

const variantFile = (sketch: Sketch, variant: string, file: string) => join(sketch.dir, variant, 'elements/hero', file);

const edit = (file: string, from: string, to: string) =>
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));

const sketched = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rebase-port-'));

  targets.push(target);
  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  git(target, 'init', '-q');
  git(target, 'add', '-A');
  git(target, 'commit', '-qm', 'base');

  const sketch = createSketch({
    product: resolveAcme(target),
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;

  return { target, sketch };
};

const changeProduct = (target: string, file: string, from: string, to: string) => {
  edit(join(heroDir(target), file), from, to);
  git(target, 'commit', '-qam', 'product change');
};

afterEach(() => targets.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true })));

describe('portBaseChanges', () => {
  it('takes a product change into each variant that left the file alone', () => {
    const { target, sketch } = sketched();

    edit(variantFile(sketch, 'b', 'hero.css'), 'background', 'background-color');
    changeProduct(target, 'hero.ts', 'One featured film', 'The featured film');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });

    expect(port.conflicts).toEqual([]);
    expect(port.ported.map(({ variant, file, how }) => `${variant} ${file} ${how}`)).toEqual([
      'a elements/hero/hero.ts taken',
      'b elements/hero/hero.ts taken',
    ]);
    expect(readFileSync(variantFile(sketch, 'b', 'hero.ts'), 'utf8')).toContain('The featured film');
    expect(readFileSync(variantFile(sketch, 'b', 'hero.css'), 'utf8')).toContain('background-color');
  });

  it('merges a product change and a variant change on different lines of one file', () => {
    const { target, sketch } = sketched();

    edit(variantFile(sketch, 'b', 'hero.ts'), 'One featured film', 'A featured film');
    changeProduct(target, 'hero.ts', '<h1>', '<h1 class="acme-hero-title">');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });
    const source = readFileSync(variantFile(sketch, 'b', 'hero.ts'), 'utf8');

    expect(port.ported.map(({ variant, how }) => `${variant} ${how}`)).toEqual(['a taken', 'b merged']);
    expect(source).toContain('A featured film');
    expect(source).toContain('<h1 class="acme-hero-title">');
  });

  it('writes nothing and lists the file when the variant and the product changed the same line', () => {
    const { target, sketch } = sketched();

    edit(variantFile(sketch, 'a', 'hero.ts'), 'One featured film', 'A featured film');
    edit(variantFile(sketch, 'b', 'hero.css'), 'background', 'background-color');
    changeProduct(target, 'hero.ts', 'One featured film', 'The featured film');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });

    expect(port.ported).toEqual([]);
    expect(port.conflicts).toEqual(['a: elements/hero/hero.ts - the variant and the product both changed it']);
    expect(readFileSync(variantFile(sketch, 'b', 'hero.ts'), 'utf8')).toContain('One featured film');
  });

  it('refuses when no commit holds the state the baseline recorded', () => {
    const { target } = sketched();

    rmSync(join(target, '.ethlete/design/acme/sketches'), { recursive: true, force: true });
    edit(join(heroDir(target), 'hero.css'), 'opacity', 'filter');

    const sketch = createSketch({
      product: resolveAcme(target),
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    }) as Sketch;

    changeProduct(target, 'hero.css', 'filter', 'transform');

    expect(portBaseChanges({ target, product: resolveAcme(target), sketch }).conflicts).toEqual([
      'a: elements/hero - no commit holds the state the baseline recorded, port it by hand',
    ]);
  });
});
