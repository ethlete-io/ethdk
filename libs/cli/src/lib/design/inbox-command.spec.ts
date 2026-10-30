import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designComment, designInbox } from './inbox-command';
import { DESIGN_DIR, readConfig } from './paths';
import { createSketch, parseTarget, readSketch } from './system/sketch/sketch';
import { createSystemModules } from './system/system-modules';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-inbox-command-'));

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

const invocation = 'et design';

describe('designComment and designInbox', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes a comment, lists it and resolves it once done', () => {
    const target = acme();
    const lines = output();
    const argv = ['pages/home', 'empty', '--size', 'phone', '--at', '10,20', '--product', 'acme', 'Say', 'why.'];

    expect(designComment({ target, argv, invocation })).toBe(0);

    const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';

    expect(designInbox({ target, argv: ['--json'], invocation })).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      items: [
        expect.objectContaining({ kind: 'comment', id, part: 'pages/home', point: { x: 10, y: 20 }, text: 'Say why.' }),
      ],
      waitingForUser: [],
    });
    expect(designComment({ target, argv: ['reply', id, '--product', 'acme', 'Which', 'part?'], invocation })).toBe(2);
    expect(lines.pop()).toContain('comment reply needs --by <model id>');
    expect(
      designComment({
        target,
        argv: ['reply', id, '--product', 'acme', '--by', 'gpt-5.6-sol', 'Which', 'part?'],
        invocation,
      }),
    ).toBe(0);
    expect(lines.pop()).toBe(`replied: .ethlete/design/acme/comments/${id}.json`);
    expect(designInbox({ target, argv: ['--json'], invocation })).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      items: [],
      waitingForUser: [
        expect.objectContaining({
          id,
          threadState: 'answered',
          replies: [expect.objectContaining({ by: 'agent', author: 'gpt-5.6-sol', text: 'Which part?' })],
        }),
      ],
    });
    expect(
      designComment({
        target,
        argv: ['reply', id, '--question', '--product', 'acme', '--by', 'gpt-5.6-sol', 'Title', 'or', 'list?'],
        invocation,
      }),
    ).toBe(0);
    expect(lines.pop()).toBe(`asked: .ethlete/design/acme/comments/${id}.json`);
    expect(designInbox({ target, argv: ['--json'], invocation })).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      items: [],
      waitingForUser: [
        expect.objectContaining({
          id,
          threadState: 'question',
          replies: [
            expect.objectContaining({ text: 'Which part?' }),
            expect.objectContaining({ by: 'agent', text: 'Title or list?', question: true }),
          ],
        }),
      ],
    });
    expect(designComment({ target, argv: ['reply', id], invocation })).toBe(2);
    expect(designInbox({ target, argv: ['done', id, '--note', 'A title over a list.'], invocation })).toBe(2);
    expect(lines.pop()).toContain('inbox done needs --by <model id>');
    expect(designInbox({ target, argv: ['done', id, '--by', 'gpt-5.6-sol'], invocation })).toBe(1);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/comments', `${id}.json`))).toBe(true);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.ts'), 'utf8')).toContain(
      'A hero over a list of cards.',
    );
    expect(
      designInbox({ target, argv: ['done', id, '--note', 'A title over a list.', '--by', 'gpt-5.6-sol'], invocation }),
    ).toBe(0);
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.ts'), 'utf8')).toContain(
      "note: 'A title over a list.'",
    );
    expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/comments', `${id}.json`), 'utf8'))).toMatchObject({
      addressed: { by: 'agent', author: 'gpt-5.6-sol', reason: 'done', note: 'A title over a list.' },
    });
    expect(designInbox({ target, argv: [], invocation })).toBe(0);
    expect(lines.pop()).toBe('inbox empty');
    expect(designComment({ target, argv: ['reply', id, '--by', 'gpt-5.6-sol', 'Set the title.'], invocation })).toBe(0);
    expect(designInbox({ target, argv: [], invocation })).toBe(0);
    expect(lines.pop()).toBe('inbox empty');
  });

  it('stores the id of inbox done in the madeBy of the part, once', () => {
    const target = acme();
    const lines = output();
    const home = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');
    const argv = ['pages/home', 'empty', '--size', 'phone', '--product', 'acme', 'Say', 'why.'];
    const done = () => {
      designComment({ target, argv, invocation });

      const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';

      return designInbox({ target, argv: ['done', id, '--note', 'A hero.', '--by', 'gpt-5.6-sol'], invocation });
    };

    expect(done()).toBe(0);
    expect(done()).toBe(0);
    expect(readFileSync(home, 'utf8').match(/madeBy: \['gpt-5\.6-sol'\]/gu)).toHaveLength(1);
  });

  it('stores the id of inbox done in the authors of the sketch variant a comment sat on', () => {
    const target = acme();
    const lines = output();
    const config = readConfig(target) ?? {};
    const product = createSystemModules({ target, config }).productOf('acme');
    const parsed = parseTarget('components/card');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a', 'b'] });
    designComment({
      target,
      argv: [
        'pages/home',
        'empty',
        '--size',
        'phone',
        '--sketch',
        'components/card',
        '--variant',
        'a',
        '--product',
        'acme',
        'Why?',
      ],
      invocation,
    });

    const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';
    const done = () =>
      designInbox({ target, argv: ['done', id, '--note', 'A hero.', '--by', 'gpt-5.6-sol'], invocation });

    expect(done()).toBe(0);

    const sketch = readSketch({ product: 'acme', dir: join(target, DESIGN_DIR, 'acme/sketches/components-card') });

    expect(typeof sketch === 'string' ? sketch : sketch.variantInfo).toEqual({
      a: { authors: ['gpt-5.6-sol'], round: 'r1' },
      b: { round: 'r1' },
    });
    expect(readFileSync(join(target, DESIGN_DIR, 'acme/pages/home/home.ts'), 'utf8')).not.toContain('madeBy');
  });

  it('writes the note of inbox done into the variant, never into the product', () => {
    const target = acme();
    const lines = output();
    const config = readConfig(target) ?? {};
    const product = createSystemModules({ target, config }).productOf('acme');
    const parsed = parseTarget('pages/home');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a'] });

    const homeFile = join(target, DESIGN_DIR, 'acme/pages/home/home.ts');
    const variantFile = join(target, DESIGN_DIR, 'acme/sketches/pages-home/a/pages/home/home.ts');
    const before = readFileSync(homeFile);

    designComment({
      target,
      argv: [
        'pages/home',
        'empty',
        '--size',
        'phone',
        '--sketch',
        'pages/home',
        '--variant',
        'a',
        '--product',
        'acme',
        'Why?',
      ],
      invocation,
    });

    const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';

    expect(designInbox({ target, argv: ['done', id, '--note', 'Variant a.', '--by', 'gpt-5.6-sol'], invocation })).toBe(
      0,
    );
    expect(readFileSync(homeFile).equals(before)).toBe(true);
    expect(readFileSync(variantFile, 'utf8')).toContain("note: 'Variant a.'");
  });

  it('writes the note of inbox done into a sketch variant whose part is new to the product', () => {
    const target = acme();
    const lines = output();
    const config = readConfig(target) ?? {};
    const product = createSystemModules({ target, config }).productOf('acme');
    const parsed = parseTarget('components/fresh');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    expect(typeof createSketch({ product, sketch: parsed, variants: ['a'] })).toBe('object');

    const variantFile = join(target, DESIGN_DIR, 'acme/sketches/components-fresh/a/components/fresh/fresh.ts');

    expect(
      designComment({
        target,
        argv: [
          'components/fresh',
          'default',
          '--size',
          'phone',
          '--sketch',
          'components/fresh',
          '--variant',
          'a',
          '--product',
          'acme',
          'Why?',
        ],
        invocation,
      }),
    ).toBe(0);

    const id = /^comment (\S+):/u.exec(lines.pop() ?? '')?.[1] ?? '';

    expect(designInbox({ target, argv: ['done', id, '--note', 'Fresh a.', '--by', 'gpt-5.6-sol'], invocation })).toBe(
      0,
    );
    expect(readFileSync(variantFile, 'utf8')).toContain("note: 'Fresh a.'");
  });

  it('refuses a comment without a size, a bad point or a stale part', () => {
    const target = acme();
    const lines = output();

    expect(
      designComment({
        target,
        argv: ['pages/home', 'empty', 'x', '--product', 'acme'],
        invocation,
      }),
    ).toBe(2);
    expect(
      designComment({ target, argv: ['pages/home', 'empty', 'x', '--size', '0', '--product', 'acme'], invocation }),
    ).toBe(2);
    expect(
      designComment({ target, argv: ['pages/home', 'empty', 'x', '--size', 'phone', '--at', '1'], invocation }),
    ).toBe(2);
    expect(
      designComment({
        target,
        argv: ['pages/nope', 'empty', 'x', '--size', 'phone', '--product', 'acme'],
        invocation,
      }),
    ).toBe(1);
    expect(lines.pop()).toBe('part pages/nope no longer exists');
    expect(designInbox({ target, argv: ['done', 'nope', '--note', 'x', '--by', 'gpt-5.6-sol'], invocation })).toBe(1);
    expect(lines.pop()).toBe('no open comment "nope"');
  });
});
