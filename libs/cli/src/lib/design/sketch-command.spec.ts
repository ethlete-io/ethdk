import { cpSync, existsSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './paths';
import { designSketch } from './sketch-command';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-command-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  return target;
};

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);

  return lines;
};

const run = (target: string, ...argv: string[]) => designSketch({ target, argv, invocation: 'et design' });

describe('designSketch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints the usage for an unknown command', () => {
    const lines = output();

    expect(run(acme(), 'nope')).toBe(2);
    expect(lines[0]).toContain('usage: et design sketch new <layer>/<name> --variants a,b');
  });

  it('opens, lists, previews, readies and discards a sketch', () => {
    const target = acme();
    const lines = output();

    expect(run(target, 'new', 'components/button', '--variants', 'a,b')).toBe(1);
    expect(lines.pop()).toBe('pass --product <name> - config.json declares acme-base, acme.');
    expect(run(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe(`components/button in progress: ${DESIGN_DIR}/acme/sketches/components-button with a, b`);
    expect(run(target, 'report', 'components/button', 'variant', 'b,', 'phone', '--product', 'acme')).toBe(0);
    expect(run(target, 'list')).toBe(0);
    expect(lines.pop()).toBe('acme  components/button  in progress  a, b');
    expect(run(target, 'preview', 'components/button', 'a', '--product', 'acme', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      changed: ['components/button'],
      affected: ['elements/hero', 'pages/home'],
    });
    expect(run(target, 'merge', 'components/button', 'a', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe(
      'usage: sketch merge <layer>/<name> --note <reason> - it merges the variant the user picked',
    );
    expect(run(target, 'merge', 'components/button', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe('components/button is in progress - mark it ready before a merge');
    expect(run(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button is ready');
    expect(run(target, 'merge', 'components/button', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe('components/button has no pick - the user picks a variant in Studio before a merge');
    expect(run(target, 'rebase', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button now compares with the product as it is');
    expect(run(target, 'discard', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
    expect(run(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('NO SKETCH on components/button in acme');
  });

  it('checks each variant of the open sketches', () => {
    const target = acme();
    const lines = output();

    run(target, 'new', 'elements/hero', '--variants', 'a,b', '--product', 'acme');
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.css'),
      '.acme-hero { color: #fff; }',
    );

    expect(run(target, 'check', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      `elements/hero b: HARD-CODED-COLOUR ${DESIGN_DIR}/acme/sketches/elements-hero/b/elements/hero/hero.css: #fff outside foundations - use a foundations token`,
    );
  }, 120_000);
});
