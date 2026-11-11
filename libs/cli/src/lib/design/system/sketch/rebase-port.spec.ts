import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { git } from '../git-repo.fixtures';
import { resolveProduct } from '../resolve-product';
import { portBaseChanges } from './rebase-port';
import { createSketch, Sketch } from './sketch';

const targets: string[] = [];

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const heroDir = (target: string) => join(target, '.ethlete/design/acme/elements/hero');

const variantFile = (sketch: Sketch, variant: string, file: string) => join(sketch.dir, variant, 'elements/hero', file);

const edit = (file: string, from: string, to: string) =>
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));

const sketched = (options: { sharedLabel?: boolean } = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-rebase-port-'));

  targets.push(target);
  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  if (options.sharedLabel) {
    mkdirSync(join(heroDir(target), 'shared'));
    writeFileSync(join(heroDir(target), 'shared/label.ts'), "export const label = 'One featured film';\n");
  }

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

  it('counts a file the variant already holds as the product now has it as clean', () => {
    const { target, sketch } = sketched();

    edit(variantFile(sketch, 'a', 'hero.ts'), 'One featured film', 'The featured film');
    changeProduct(target, 'hero.ts', 'One featured film', 'The featured film');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });

    expect(port.conflicts).toEqual([]);
    expect(port.ported.map(({ variant, how }) => `${variant} ${how}`)).toEqual(['b taken']);
  });

  it('skips a product hunk the variant already took over by hand at another line', () => {
    const { target, sketch } = sketched();
    const trim = "import { trim } from './trim';\n";

    edit(
      variantFile(sketch, 'b', 'hero.ts'),
      "import styles from './hero.css?inline';\n",
      `import styles from './hero.css?inline';\n${trim}`,
    );
    edit(variantFile(sketch, 'b', 'hero.ts'), 'One featured film', 'A featured film');
    edit(
      join(heroDir(target), 'hero.ts'),
      "import { Film, films } from '@system/fixtures';\n",
      `${trim}import { Film, films } from '@system/fixtures';\n`,
    );
    changeProduct(target, 'hero.ts', '<h1>', '<h1 class="acme-hero-title">');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });
    const source = readFileSync(variantFile(sketch, 'b', 'hero.ts'), 'utf8');

    expect(port.conflicts).toEqual([]);
    expect(source.split(trim).length - 1).toBe(1);
    expect(source).toContain('<h1 class="acme-hero-title">');
    expect(source).toContain('A featured film');
  });

  it('compares a part shared file with the copy the sketch lifted into its shared folder', () => {
    const { target, sketch } = sketched({ sharedLabel: true });
    const lifted = join(sketch.dir, 'shared/label.ts');

    expect(existsSync(variantFile(sketch, 'a', 'shared/label.ts'))).toBe(false);

    edit(lifted, 'One featured film', 'The featured film');
    changeProduct(target, 'shared/label.ts', 'One featured film', 'The featured film');

    expect(portBaseChanges({ target, product: resolveAcme(target), sketch })).toEqual({ ported: [], conflicts: [] });
  });

  it('ports a product change of a part shared file into the lifted copy', () => {
    const { target, sketch } = sketched({ sharedLabel: true });
    const lifted = join(sketch.dir, 'shared/label.ts');

    changeProduct(target, 'shared/label.ts', 'One featured film', 'The featured film');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch });

    expect(port.conflicts).toEqual([]);
    expect(readFileSync(lifted, 'utf8')).toContain('The featured film');
    expect(existsSync(variantFile(sketch, 'a', 'shared/label.ts'))).toBe(false);
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

  it('keeps a conflicting file that was ported by hand and ports the rest', () => {
    const { target, sketch } = sketched();

    edit(variantFile(sketch, 'a', 'hero.ts'), 'One featured film', 'A featured film');
    changeProduct(target, 'hero.ts', 'One featured film', 'The featured film');

    const port = portBaseChanges({ target, product: resolveAcme(target), sketch, keepConflicts: true });

    expect(port.conflicts).toEqual(['a: elements/hero/hero.ts - the variant and the product both changed it']);
    expect(port.ported.map(({ variant, how }) => `${variant} ${how}`)).toEqual(['b taken']);
    expect(readFileSync(variantFile(sketch, 'a', 'hero.ts'), 'utf8')).toContain('A featured film');
    expect(readFileSync(variantFile(sketch, 'b', 'hero.ts'), 'utf8')).toContain('The featured film');
  });
});
