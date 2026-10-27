import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
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

const write = (target: string, ...argv: string[]) => run(target, ...argv, '--by', 'claude-opus-5-5');

describe('designSketch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints the usage for an unknown command', () => {
    const lines = output();

    expect(run(acme(), 'nope')).toBe(2);
    expect(lines[0]).toContain('usage: et design sketch new <layer>/<name> --variants a,b');
  });

  it('refuses every write without --by', () => {
    const target = acme();
    const lines = output();

    for (const argv of [
      ['new', 'components/button', '--variants', 'a,b'],
      ['variant', 'components/button', 'c', '--from', 'a'],
      ['report', 'components/button', '--variant', 'a', 'phone'],
      ['ready', 'components/button'],
      ['rebase', 'components/button'],
      ['merge', 'components/button', '--note', 'x'],
      ['discard', 'components/button'],
    ]) {
      expect(run(target, ...argv, '--product', 'acme')).toBe(2);
      expect(lines).toContain(
        `sketch ${argv[0]} needs --by <model id>: the exact model id the coordinator gave you, e.g. claude-opus-5-5. Never guess it.`,
      );
    }

    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
  });

  it('reports on the variant --variant names and records the author', () => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme');

    expect(write(target, 'report', 'components/button', 'variant', 'b', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('usage: sketch report <layer>/<name> --variant <key> --by <model id> <text>');
    expect(write(target, 'report', 'components/button', '--variant', 'c', 'phone', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no variant "c" - it has a, b');
    expect(
      run(target, 'report', 'components/button', '--variant', 'b', '--by', 'gpt-5.6-sol', 'phone', '--product', 'acme'),
    ).toBe(0);
    expect(write(target, 'report', 'components/button', '--variant', 'b', 'desktop', '--product', 'acme')).toBe(0);
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].variantInfo).toEqual({
      a: { authors: ['claude-opus-5-5'], round: 'r1' },
      b: { authors: ['claude-opus-5-5', 'gpt-5.6-sol'], round: 'r1' },
    });
  });

  it('records the author of every variant that new, variant and ready write', () => {
    const target = acme();
    const lines = output();

    run(target, 'new', 'components/button', '--variants', 'a,b', '--by', 'gpt-5.6-sol', '--product', 'acme');
    run(target, 'variant', 'components/button', 'c', '--from', 'a', '--by', 'claude-opus-5-5', '--product', 'acme');
    run(target, 'variant', 'components/button', 'd', '--from', 'a', '--by', 'claude-opus-5-5', '--product', 'acme');

    const file = join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json');
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...stored, variantInfo: { ...stored.variantInfo, d: { round: 'r1' } } }));

    expect(run(target, 'ready', 'components/button', '--by', 'gpt-5.6-terra', '--product', 'acme')).toBe(0);
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].variantInfo).toEqual({
      a: { authors: ['gpt-5.6-sol'], round: 'r1' },
      b: { authors: ['gpt-5.6-sol'], round: 'r1' },
      c: { authors: ['claude-opus-5-5'], round: 'r1' },
      d: { authors: ['gpt-5.6-terra'], round: 'r1' },
    });
  });

  it('adds a variant from another, in the running round or a new one', () => {
    const target = acme();
    const lines = output();
    const variant = (...argv: string[]) => write(target, 'variant', 'components/button', ...argv, '--product', 'acme');

    write(target, 'new', 'components/button', '--variants', 'a,b', '--round', 'Pill or square', '--product', 'acme');

    expect(variant('c')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch variant <layer>/<name> <variant> --from <variant>');
    expect(variant('c', '--from', 'a', '--round', 'Combined')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch variant');
    expect(variant('c', '--from', 'z')).toBe(1);
    expect(lines.pop()).toBe('components/button has no variant "z" - it has a, b');
    expect(variant('c', '--from', 'a', '--round', 'Combined', '--note', 'the user wants a with b')).toBe(0);
    expect(lines.pop()).toBe('components/button in progress: variant c from a in round r2');
    expect(variant('d', '--from', 'c')).toBe(0);
    expect(lines.pop()).toBe('components/button in progress: variant d from c in round r2');
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0]).toMatchObject({
      variants: ['a', 'b', 'c', 'd'],
      rounds: [
        { key: 'r1', title: 'Pill or square', note: 'the user wants a with b' },
        { key: 'r2', title: 'Combined', note: '' },
      ],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, c: { round: 'r2' }, d: { round: 'r2' } },
    });
  });

  it('closes the open comments on the variant a new round starts from', () => {
    const target = acme();
    const lines = output();
    const comments = join(target, DESIGN_DIR, 'acme/comments');
    const comment = (id: string, sketch?: { target: string; variant: string }) => {
      const file = join(comments, `${id}.json`);

      writeFileSync(
        file,
        JSON.stringify({
          part: 'components/button',
          state: 'default',
          size: 'phone',
          text: 'Rounder.',
          createdAt: '2026-10-27T10:00:00Z',
          ...(sketch ? { sketch } : {}),
        }),
      );

      return file;
    };

    write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme');
    mkdirSync(comments, { recursive: true });

    const onA = comment('on-a', { target: 'components/button', variant: 'a' });
    const onB = comment('on-b', { target: 'components/button', variant: 'b' });
    const onPart = comment('on-part');

    expect(write(target, 'variant', 'components/button', 'c', '--from', 'b', '--product', 'acme')).toBe(0);
    expect(existsSync(onB)).toBe(true);
    expect(
      write(
        target,
        'variant',
        'components/button',
        'd',
        '--from',
        'a',
        '--round',
        'Rounder',
        '--note',
        'too square',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(lines.pop()).toBe('closed 1 comment(s) on variant a: on-a');
    expect(existsSync(onA)).toBe(false);
    expect(existsSync(onB)).toBe(true);
    expect(existsSync(onPart)).toBe(true);
  });

  it('opens, lists, previews, readies and discards a sketch', () => {
    const target = acme();
    const lines = output();

    expect(write(target, 'new', 'components/button', '--variants', 'a,b')).toBe(1);
    expect(lines.pop()).toBe('pass --product <name> - config.json declares acme-base, acme.');
    expect(write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe(`components/button in progress: ${DESIGN_DIR}/acme/sketches/components-button with a, b`);
    expect(write(target, 'report', 'components/button', '--variant', 'b', 'phone', '--product', 'acme')).toBe(0);
    expect(run(target, 'list')).toBe(0);
    expect(lines.pop()).toBe('acme  components/button  in progress  a, b');
    expect(run(target, 'preview', 'components/button', 'a', '--product', 'acme', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      changed: ['components/button'],
      affected: ['elements/hero', 'pages/home'],
    });
    expect(write(target, 'merge', 'components/button', 'a', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe(
      'usage: sketch merge <layer>/<name> [--note <reason>] - it merges the variant the user picked',
    );
    expect(write(target, 'merge', 'components/button', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe('components/button is in progress - mark it ready before a merge');
    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button is ready');
    expect(write(target, 'merge', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no pick - the user picks a variant in Studio before a merge');
    expect(write(target, 'rebase', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button now compares with the product as it is');
    expect(write(target, 'discard', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('NO SKETCH on components/button in acme');
  });

  it('checks each variant of the open sketches', () => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'elements/hero', '--variants', 'a,b', '--product', 'acme');
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
