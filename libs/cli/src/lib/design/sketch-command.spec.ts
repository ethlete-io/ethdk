import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './paths';
import { shotsShowNoChange } from './ready-shots';
import { designSketch } from './sketch-command';
import { findSketch, readSketchReport, Sketch } from './system/sketch/sketch';

vi.mock('./ready-shots', () => ({
  shotsShowNoChange: vi.fn(async (): Promise<true | string> => 'variant a changes default'),
}));

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-command-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');

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

  it('merges a ready sketch by itself and logs it auto when no state shows a change', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    vi.mocked(shotsShowNoChange).mockResolvedValueOnce(true);

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a',
      '--round',
      'Same',
      '--note',
      'no change',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('No visible change in any state: merged components/button automatically.');
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
    expect(JSON.parse(readFileSync(join(product, 'accepted.json'), 'utf8'))).toMatchObject([
      { part: 'components/button', by: 'claude-opus-5-5', auto: true },
    ]);
  });

  it('runs the check and the auto merge again on a sketch that is already ready', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a',
      '--round',
      'Same',
      '--note',
      'no change',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(true);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button is ready, not in progress');

    vi.mocked(shotsShowNoChange).mockResolvedValueOnce(true);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
  });

  it('keeps a sketch ready when a state shows a change and names why', async () => {
    const target = acme();
    const lines = output();
    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a',
      '--round',
      'Diff',
      '--note',
      'changes',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(true);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/accepted.json'))).toBe(false);
    expect(lines.pop()).toBe('auto-merge skipped: variant a changes default');
  });

  it('names an unknown command and prints the usage', () => {
    const lines = output();

    expect(run(acme(), 'nope')).toBe(2);
    expect(lines[0]).toBe('unknown sketch command "nope"');
    expect(lines[1]).toContain('usage: et design sketch new <layer>/<name> --variants a,b');
  });

  it('edits the title and note of a round and lists the rounds', () => {
    const target = acme();
    const lines = output();
    const round = (...argv: string[]) => write(target, 'round', 'components/button', ...argv, '--product', 'acme');

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a,b',
      '--round',
      'Pill',
      '--note',
      'pill',
      '--product',
      'acme',
    );

    expect(round('r1')).toBe(1);
    expect(lines.pop()).toBe('pass --title <text>, --note <text> or --drops <state,state>');
    expect(round('r9', '--title', 'x')).toBe(1);
    expect(lines.pop()).toBe('components/button has no round "r9" - it has r1');
    expect(round('r1', '--title', 'Pill or square', '--note', 'a won')).toBe(0);
    expect(round('r1', '--note', 'a clearly won')).toBe(0);
    expect(run(target, 'list', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('  r1  Pill or square  a, b  - a clearly won');
    expect(round('r1', '--drops', 'empty, long')).toBe(0);
    expect(lines.pop()).toBe('components/button round r1: Pill or square - a clearly won - drops empty, long');
    expect(round('r1', '--drops', '')).toBe(0);
    expect(lines.pop()).toBe('components/button round r1: Pill or square - a clearly won');
  });

  it('says --product when report finds more than one product', () => {
    const lines = output();

    expect(write(acme(), 'report', 'components/button', '--variant', 'a', 'phone')).toBe(1);
    expect(lines.pop()).toContain('--product');
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
    expect(lines.pop()).toContain(
      'usage: sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done)',
    );
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

  it('ends the live report of a variant with --done', () => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme');
    write(target, 'report', 'components/button', '--variant', 'b', 'phone', '--product', 'acme');

    const sketch = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    }) as Sketch;

    expect(write(target, 'report', 'components/button', '--variant', 'a', '--done', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button variant a marked done');
    expect(readSketchReport({ checkout: target, sketch })?.variant).toBe('b');

    expect(write(target, 'report', 'components/button', '--variant', 'b', '--done', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button variant b marked done');
    expect(readSketchReport({ checkout: target, sketch })).toBeNull();
  });

  it('refuses a new round without a note, and ready until the round has one', async () => {
    const target = acme();
    const lines = output();

    expect(write(target, 'new', 'components/button', '--variants', 'a,b', '--round', 'Pill', '--product', 'acme')).toBe(
      1,
    );
    expect(lines.pop()).toBe(
      '--round needs --note "<what the round shows>" - sketch ready refuses a round without a note',
    );
    expect(write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme')).toBe(0);
    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toContain('round r1 has no note - set it with: sketch round components/button r1 --note');
    expect(write(target, 'round', 'components/button', 'r1', '--note', 'pill', '--product', 'acme')).toBe(0);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
  });

  it('warns of a class two stylesheets of one part define, and still readies', async () => {
    const target = acme();

    output();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    write(target, 'new', 'components/button', '--variants', 'a,b', '--note', 'n', '--product', 'acme');

    const folder = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button');
    const ts = join(folder, 'button.ts');

    writeFileSync(join(folder, 'extra.css'), '.acme-button { color: red; }');
    writeFileSync(join(folder, 'button.css'), '.acme-button { color: blue; }');
    writeFileSync(ts, `import extra from './extra.css?inline';\n${readFileSync(ts, 'utf8')}`);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('b: WARNING components/button: .acme-button is defined in'),
    );
  });

  it('refuses ready while a variant drops a state of the part', () => {
    const target = acme();
    const lines = output();
    const button = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button/button.ts');

    write(target, 'new', 'components/button', '--variants', 'a,b', '--note', 'n', '--product', 'acme');
    writeFileSync(button, readFileSync(button, 'utf8').replace(/, long: \{[^}]*\}/u, ''));

    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'components/button b: STATES .ethlete/design/acme/sketches/components-button/b/components/button/button.ts: drops the state long that components/button has in acme - a variant keeps every state of the part\ncomponents/button has problems - fix them before ready',
    );
  });

  it('refuses ready and fails check while a variant is not formatted', async () => {
    const target = acme();
    const lines = output();
    const css = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button/button.css');

    rmSync(join(target, '.prettierignore'));
    write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme');
    writeFileSync(css, `${readFileSync(css, 'utf8')}\n.acme-button   {   }\n`);

    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.join('\n')).toContain('FORMAT');
    expect(lines.join('\n')).toContain('sketch check components/button --fix');
    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(1);
    lines.length = 0;
    expect(await run(target, 'check', 'components/button', '--fix', '--product', 'acme')).toBe(0);
    expect(lines.join('\n')).not.toContain('FORMAT');
  });

  it('writes new and added variants and sketch.json in the format the checkout holds them to', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    rmSync(join(target, '.prettierignore'));
    writeFileSync(join(target, '.prettierrc'), '{ "printWidth": 40 }\n');
    write(target, 'new', 'components/button', '--variants', 'a,b', '--product', 'acme');
    write(target, 'variant', 'components/button', 'c', '--from', 'a', '--product', 'acme');

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.join('\n')).not.toContain('FORMAT');
    expect(readFileSync(join(product, 'sketches/components-button/sketch.json'), 'utf8')).toContain(
      '"authors": ["claude-opus-5-5"]',
    );
  });

  it('keeps the note --variant-note names in sketch.json and leaves the merged note in the part file', () => {
    const target = acme();
    const lines = output();
    const fileOf = (variant: string) =>
      join(target, DESIGN_DIR, `acme/sketches/components-button/${variant}/components/button/button.ts`);

    expect(
      write(target, 'new', 'components/button', '--variants', 'a,b', '--variant-note', 'z=x', '--product', 'acme'),
    ).toBe(1);
    expect(lines.pop()).toContain('--variant-note needs <variant>=<text>');
    expect(
      write(
        target,
        'new',
        'components/button',
        '--variants',
        'a,b',
        '--variant-note',
        'a=Pill shape',
        '--variant-note',
        "b=Square, it's flat",
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(readFileSync(fileOf('a'), 'utf8')).toContain("note: 'Pill shape, because Acme rounds every action.'");
    expect(readFileSync(fileOf('b'), 'utf8')).toContain("note: 'Pill shape, because Acme rounds every action.'");
    const sketch = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    }) as Sketch;

    expect(sketch.variantInfo).toMatchObject({
      a: { note: 'Pill shape' },
      b: { note: "Square, it's flat" },
    });
  });

  it('lists the shared files a page sketch moves out of the part', () => {
    const target = acme();
    const lines = output();
    const part = join(target, DESIGN_DIR, 'acme/components/button/shared');
    mkdirSync(part, { recursive: true });
    writeFileSync(join(part, 'data.ts'), 'export const rows = [];\n');
    write(target, 'new', 'components/button', '--variants', 'a', '--product', 'acme');

    expect(lines.slice(-2)).toEqual([
      '  shared by every variant, imported as @shared/<path>; edit it here, not in a copy:',
      `    ${DESIGN_DIR}/acme/sketches/components-button/shared/data.ts`,
    ]);
  });

  it('takes the product that holds the sketch when --product is missing', async () => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'components/button', '--variants', 'a', '--product', 'acme');

    expect(write(target, 'variant', 'components/button', 'b', '--from', 'a')).toBe(0);
    expect(lines.pop()).toContain('acme/sketches/components-button/b/');
    expect(await run(target, 'check', 'components/button')).toBe(0);
    expect(await run(target, 'check')).toBe(0);
    expect(write(target, 'variant', 'components/card', 'b', '--from', 'a')).toBe(1);
    expect(lines.pop()).toContain('more than one product - pass --product');
  });

  it('adds every variant of a comma list, the first one opening the round', () => {
    const target = acme();
    const lines = output();
    const variant = (...argv: string[]) => write(target, 'variant', 'components/button', ...argv, '--product', 'acme');

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a,b',
      '--round',
      'Pill',
      '--note',
      'pill',
      '--product',
      'acme',
    );

    expect(variant('d,a', '--from', 'a')).toBe(1);
    expect(lines.pop()).toBe('components/button already has a variant "a"');
    expect(variant('d,E', '--from', 'a')).toBe(1);
    expect(lines.pop()).toContain('"E" is no variant name');
    expect(variant('d,e,f', '--from', 'a', '--round', 'Mixed', '--note', 'a won')).toBe(0);
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0]).toMatchObject({
      variants: ['a', 'b', 'd', 'e', 'f'],
      rounds: [
        { key: 'r1', lost: 'a won' },
        { key: 'r2', title: 'Mixed' },
      ],
      variantInfo: { d: { round: 'r2' }, e: { round: 'r2' }, f: { round: 'r2' } },
    });
  });

  it('records the author of every variant that new, variant and ready write', async () => {
    const target = acme();
    const lines = output();

    run(
      target,
      'new',
      'components/button',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--by',
      'gpt-5.6-sol',
      '--product',
      'acme',
    );
    run(target, 'variant', 'components/button', 'c', '--from', 'a', '--by', 'claude-opus-5-5', '--product', 'acme');
    run(target, 'variant', 'components/button', 'd', '--from', 'a', '--by', 'claude-opus-5-5', '--product', 'acme');

    const file = join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json');
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...stored, variantInfo: { ...stored.variantInfo, d: { round: 'r1' } } }));

    expect(await run(target, 'ready', 'components/button', '--by', 'gpt-5.6-terra', '--product', 'acme')).toBe(0);
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].variantInfo).toEqual({
      a: { authors: ['gpt-5.6-sol'], round: 'r1' },
      b: { authors: ['gpt-5.6-sol'], round: 'r1' },
      c: { authors: ['claude-opus-5-5'], round: 'r1' },
      d: { authors: ['gpt-5.6-terra'], round: 'r1' },
    });
  });

  it('names the start command when sketch variant finds no open sketch', () => {
    const lines = output();

    expect(write(acme(), 'variant', 'components/button', 'c', '--from', 'a', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'NO SKETCH on components/button in acme - start one with: sketch new components/button --variants a,b,c --round "<title>"',
    );
  });

  it('stores the note sketch new takes as the note of the first round', () => {
    const target = acme();
    const lines = output();

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a,b',
      '--round',
      'Pill',
      '--note',
      'pill or square',
      '--product',
      'acme',
    );

    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].rounds).toEqual([{ key: 'r1', title: 'Pill', note: 'pill or square' }]);
  });

  it('adds a variant from another, in the running round or a new one', () => {
    const target = acme();
    const lines = output();
    const variant = (...argv: string[]) => write(target, 'variant', 'components/button', ...argv, '--product', 'acme');

    write(
      target,
      'new',
      'components/button',
      '--variants',
      'a,b',
      '--round',
      'Pill or square',
      '--note',
      'two shapes',
      '--product',
      'acme',
    );

    expect(variant('c')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch variant <layer>/<name> <variant>[,<variant>…] --from <variant>');
    expect(variant('c', '--from', 'a', '--round', 'Combined')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch variant');
    expect(variant('c', '--from', 'z')).toBe(1);
    expect(lines.pop()).toBe('components/button has no variant "z" - it has a, b');
    expect(
      variant(
        'c',
        '--from',
        'a',
        '--round',
        'Combined',
        '--note',
        'the user wants a with b',
        '--round-note',
        'a with b',
      ),
    ).toBe(0);
    expect(lines.slice(-3)).toEqual([
      'why round r1 Pill or square lost: the user wants a with b',
      'components/button in progress: variant c from a in round r2',
      `  c: ${DESIGN_DIR}/acme/sketches/components-button/c/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/c/assets/`,
    ]);
    expect(variant('d', '--from', 'c')).toBe(0);
    expect(lines.splice(-2)).toEqual([
      'components/button in progress: variant d from c in round r2',
      `  d: ${DESIGN_DIR}/acme/sketches/components-button/d/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/d/assets/`,
    ]);
    expect(run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0]).toMatchObject({
      variants: ['a', 'b', 'c', 'd'],
      rounds: [
        { key: 'r1', title: 'Pill or square', lost: 'the user wants a with b' },
        { key: 'r2', title: 'Combined', note: 'a with b' },
      ],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, c: { round: 'r2' }, d: { round: 'r2' } },
    });
  });

  it('marks the open comments on the variant a new round starts from addressed in that round', () => {
    const target = acme();
    const lines = output();
    const comments = join(target, DESIGN_DIR, 'acme/comments');
    const comment = (id: string, sketch?: { target: string; variant: string; createdAt: string }) => {
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

    const { createdAt } = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    }) as Sketch;
    const onA = comment('on-a', { target: 'components/button', variant: 'a', createdAt });
    const onB = comment('on-b', { target: 'components/button', variant: 'b', createdAt });
    const onPart = comment('on-part');

    expect(write(target, 'variant', 'components/button', 'c', '--from', 'b', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      [
        'components/button has 2 open comment(s) - a variant that answers them starts a new round:',
        '  on-a on a: Rounder.',
        '  on-b on b: Rounder.',
        'sketch variant components/button c --from <variant> --round "<title>" --note "<why the running round lost>" --round-note "<what the new round shows>"',
        'if the variant answers none of them, close each first with: inbox done <id> --note <text>',
      ].join('\n'),
    );
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button/c'))).toBe(false);
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
    expect(lines.pop()).toBe('addressed 1 comment(s) on variant a in round r2: on-a');
    expect(JSON.parse(readFileSync(onA, 'utf8'))).toMatchObject({
      addressed: { by: 'agent', author: 'claude-opus-5-5', reason: 'round', round: 'r2', note: 'too square' },
    });
    expect(JSON.parse(readFileSync(onB, 'utf8'))).not.toHaveProperty('addressed');
    expect(JSON.parse(readFileSync(onPart, 'utf8'))).not.toHaveProperty('addressed');
  });

  it('opens, lists, previews, readies and discards a sketch', async () => {
    const target = acme();
    const lines = output();

    expect(write(target, 'new', 'components/button', '--variants', 'a,b')).toBe(1);
    expect(lines.pop()).toBe('more than one product - pass --product <name>; config.json declares acme-base, acme.');
    expect(write(target, 'new', 'components/button', '--variants', 'a,b', '--note', 'n', '--product', 'acme')).toBe(0);
    expect(lines.splice(-3)).toEqual([
      `components/button in progress: ${DESIGN_DIR}/acme/sketches/components-button with a, b`,
      `  a: ${DESIGN_DIR}/acme/sketches/components-button/a/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/a/assets/`,
      `  b: ${DESIGN_DIR}/acme/sketches/components-button/b/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/b/assets/`,
    ]);
    expect(write(target, 'report', 'components/button', '--variant', 'b', 'phone', '--product', 'acme')).toBe(0);
    expect(run(target, 'list')).toBe(0);
    expect(lines.slice(-2)).toEqual(['acme  components/button  in progress  a, b', '  r1    a, b  - n']);
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
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.splice(-2)).toEqual(['components/button is ready', 'auto-merge skipped: variant a changes default']);
    expect(write(target, 'merge', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no pick - the user picks a variant in Studio before a merge');
    expect(write(target, 'rebase', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button now compares with the product as it is');
    expect(write(target, 'discard', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
    expect(write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('NO SKETCH on components/button in acme');
  });

  it('checks each variant of the open sketches', async () => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'elements/hero', '--variants', 'a,b', '--product', 'acme');
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.css'),
      '.acme-hero { color: #fff; }',
    );

    expect(await run(target, 'check', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      `elements/hero b: HARD-CODED-COLOUR ${DESIGN_DIR}/acme/sketches/elements-hero/b/elements/hero/hero.css: #fff outside foundations - use a foundations token`,
    );
  }, 120_000);

  it('draws each variant of the open sketches and reports what breaks a render rule', async (context) => {
    const target = acme();
    const lines = output();

    write(target, 'new', 'elements/hero', '--variants', 'a,b', '--product', 'acme');
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.ts'),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A hero.',
  states: { default: {} },
  render: () => drawing({ body: html\`<button style="width: 60px">Save the draft now</button>\`, styles: '' }),
});
`,
    );

    const code = await run(target, 'check', '--product', 'acme');

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip();

    expect(code).toBe(1);
    expect(lines).toContain(
      'elements/hero b: WRAP acme elements/hero default at fitted: button[data-et-part=elements/hero] - "Save the draft now" breaks onto 4 lines; on purpose: data-et-skip="WRAP" on the element, or definePart({ checks: { skip: [\'WRAP\'] } })',
    );
    expect(lines).toContain('elements/hero a: elements/hero default at fitted ok');
    expect(lines).toContain('elements/hero b: elements/hero default at fitted WRAP');
  }, 120_000);
});
