import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { createComment, listComments } from './comments/comment';
import { designPart } from './part-command';
import { resolveProduct } from './resolve-product';
import { readMerged, recordMerged } from './sketch/merged-parts';
import { createSketch } from './sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return { target, productDir: join(target, DESIGN_DIR, 'acme') };
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const remove = (target: string, part: string) =>
  designPart({
    target,
    argv: ['remove', part, '--product', 'acme', '--by', 'claude-opus-5-5'],
    invocation: 'et design',
  });

describe('designPart remove', () => {
  afterEach(() => vi.restoreAllMocks());

  it('deletes the folder, its merged.json entry and tsconfig path, and resolves its comments', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, productDir } = acme();

    recordMerged({ product: { dir: productDir, base: null }, parts: ['pages/home', 'elements/hero'] });
    createComment({
      product: productOf(target),
      comment: { part: 'pages/home', state: 'default', size: 'fitted', text: 'too tall' },
    });

    expect(remove(target, 'pages/home')).toBe(0);
    expect(existsSync(join(productDir, 'pages/home'))).toBe(false);
    expect(Object.keys(readMerged(productDir))).toEqual(['elements/hero']);
    expect(readFileSync(join(productDir, 'tsconfig.json'), 'utf8')).not.toContain('@system/pages/home');
    expect(listComments({ productDir, product: 'acme' }).comments).toEqual([]);
    expect(listComments({ productDir, product: 'acme', all: true }).comments).toEqual([
      expect.objectContaining({ part: 'pages/home', resolved: expect.objectContaining({ by: 'user' }) }),
    ]);
  });

  it('refuses an imported part, a base part, an unknown part and a part with an open sketch', () => {
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    const { target, productDir } = acme();

    expect(remove(target, 'elements/hero')).toBe(1);
    expect(remove(target, 'components/card')).toBe(1);
    expect(remove(target, 'elements/nope')).toBe(1);

    createSketch({ product: productOf(target), sketch: { layer: 'pages', name: 'home' }, variants: ['a', 'b'] });

    expect(remove(target, 'pages/home')).toBe(1);
    expect(errors).toEqual([
      'elements/hero is imported by pages/home - remove those imports first',
      expect.stringMatching(/base product/),
      expect.stringMatching(/NO PART/),
      expect.stringMatching(/open sketch/),
    ]);
    expect(existsSync(join(productDir, 'elements/hero'))).toBe(true);
    expect(existsSync(join(productDir, 'pages/home'))).toBe(true);
  });

  it('refuses source imports of files inside the part and reports their lines', () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));
    const { target, productDir } = acme();
    mkdirSync(join(target, 'apps/app/src'), { recursive: true });
    writeFileSync(
      join(target, 'apps/app/src/styles.css'),
      `/* styles */\n@import "../../../.ethlete/design/acme/pages/home/home.css";\n`,
    );
    expect(remove(target, 'pages/home')).toBe(1);
    expect(errors[0]).toContain('apps/app/src/styles.css:2');
    expect(existsSync(join(productDir, 'pages/home'))).toBe(true);
  });

  it('refuses a missing --by or subcommand', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { target } = acme();

    expect(designPart({ target, argv: ['remove', 'pages/home'], invocation: 'et design' })).toBe(2);
    expect(designPart({ target, argv: ['rename', 'pages/home', '--by', 'x'], invocation: 'et design' })).toBe(2);
  });
});
