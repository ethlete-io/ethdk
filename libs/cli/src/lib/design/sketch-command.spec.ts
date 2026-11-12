import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import {
  aktuellPlaceholderWarnings,
  identicalRenderLines,
  identicalRenders,
  sampleMarkDriftLines,
  variantChangesShown,
  variantsThatDoNotLoad,
} from './ready-shots';
import { designSketch } from './sketch-command';
import { THEMING_TEXT } from './system/theming-text';
import { sketchOpenPointsOf } from './system/read-open-points';
import { renderIssuesOf } from './system/render-check';
import { findSketch, readSketchReport, Sketch, variantContentHashOf } from './system/sketch/sketch';
import {
  recordShotViewed,
  shotFileOf,
  unviewedShotLinesOf,
  VariantChange,
  viewedShotFileOf,
} from './system/sketch/viewed-shots';
import { gitSpawn } from '../git-test-env.fixtures';

vi.mock('./ready-shots', () => {
  const identicalRenderLines = vi.fn<(options: object) => Promise<string[]>>(async () => []);

  return {
    aktuellPlaceholderWarnings: vi.fn(async (): Promise<string[]> => []),
    identicalRenderLines,
    sketchRenderLines: vi.fn(async (options: object) => ({
      refusals: await identicalRenderLines(options),
      warnings: [],
    })),
    identicalRenders: vi.fn(async (): Promise<{ variant: string; sibling: string | null; line: string }[]> => []),
    sampleMarkDriftLines: vi.fn(async (): Promise<string[]> => []),
    variantChangesShown: vi.fn(async (): Promise<VariantChange[] | string> => [
      { variant: 'a', change: 'variant a changes default' },
    ]),
    variantsThatDoNotLoad: vi.fn(async (): Promise<string[]> => []),
  };
});

vi.mock('./system/render-check', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/render-check')>()),
  renderIssuesOf: vi.fn(async (): Promise<Awaited<ReturnType<typeof renderIssuesOf>>> => ({
    issues: [],
    warnings: [],
    grids: [],
    drawn: [],
  })),
}));

vi.mock('./system/sketch/viewed-shots', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/sketch/viewed-shots')>()),
  unviewedShotLinesOf: vi.fn((): string[] => []),
}));

vi.mock('./system/read-open-points', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system/read-open-points')>()),
  sketchOpenPointsOf: vi.fn(() => ({ added: [], inherited: [] })),
}));

const actualSketchOpenPoints = async () =>
  (await vi.importActual<typeof import('./system/read-open-points')>('./system/read-open-points')).sketchOpenPointsOf;

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

const actualRender = async () =>
  (await vi.importActual<typeof import('./system/render-check')>('./system/render-check')).renderIssuesOf;

const wideHero = (target: string, attributes: string) => {
  writeFileSync(
    join(target, DESIGN_DIR, 'acme/sketches/elements-hero/a/elements/hero/hero.ts'),
    `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A hero.',
  states: { default: {} },
  render: () => drawing({ body: html\`<button data-et-control="save" ${attributes} style="width: 60px">Save the draft now</button>\`, styles: '' }),
});
`,
  );
};

describe('designSketch', { timeout: 120_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(unviewedShotLinesOf).mockReset().mockReturnValue([]);
    vi.mocked(variantChangesShown)
      .mockReset()
      .mockResolvedValue([{ variant: 'a', change: 'variant a changes default' }]);
  });

  it('merges a ready sketch by itself and logs it auto when no state shows a change', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'Same',
      '--note',
      'no change',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('No visible change in any state: merged components/button automatically.');
    expect(lines.filter((line) => line.startsWith('  et design commit-hunks'))).toEqual([
      '  et design commit-hunks .ethlete/design/acme/merged.json --part components/button',
    ]);
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
    expect(JSON.parse(readFileSync(join(product, 'merged.json'), 'utf8'))).toMatchObject({
      'components/button': { decidedBy: 'auto: no visible change' },
    });
  });

  it('auto-merges past an uncommitted edit outside the sketch and keeps the edit', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');
    const home = join(product, 'pages/home/home.ts');
    const git = (...args: string[]) =>
      gitSpawn(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );
    git('init');
    git('add', '.');
    git('commit', '-m', 'base');

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'Same',
      '--note',
      'no change',
      '--product',
      'acme',
    );

    const edited = `${readFileSync(home, 'utf8')}\nexport const edited = true;\n`;

    writeFileSync(home, edited);

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('No visible change in any state: merged components/button automatically.');
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
    expect(readFileSync(home, 'utf8')).toBe(edited);
    expect(git('log', '-1', '--format=%s').stdout.trim()).toBe('base');
  });
  const sameButton = (target: string) =>
    write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'Same',
      '--note',
      'no change',
      '--product',
      'acme',
    );

  const gitRepo = (target: string) => {
    const git = (...args: string[]) =>
      gitSpawn(['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: target, encoding: 'utf8' });

    writeFileSync(join(target, '.gitignore'), `${DESIGN_DIR}/tsconfig.json\n${DESIGN_DIR}/*/tsconfig.json\n`);
    git('init');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('add', '.');
    git('commit', '-m', 'base');

    return git;
  };

  it('writes why the auto-merge was skipped on the sketch', async () => {
    const target = acme();

    output();
    await sameButton(target);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);

    const sketchFile = JSON.parse(
      readFileSync(join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json'), 'utf8'),
    );

    expect(sketchFile.mergeHold).toEqual({
      reason: expect.stringContaining('variant a changes default'),
      at: expect.any(String),
    });
  });

  it('refuses cleanly when another run merged the sketch while this one checked it', async () => {
    const target = acme();
    const lines = output();
    const sketchDir = join(target, DESIGN_DIR, 'acme/sketches/components-button');

    await sameButton(target);
    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) => {
      rmSync(sketchDir, { recursive: true, force: true });

      return sketch.variants.map((variant) => ({ variant, change: null }));
    });

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(1);
    expect(lines).toContain('components/button is gone: another run merged or discarded it while this one checked it');
  });

  it('refuses a second ready run on the same sketch while the first one runs', async () => {
    const target = acme();
    const lines = output();
    const unlock = vi.fn();

    await sameButton(target);
    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) => {
      lines.push(`second run: ${await write(target, 'ready', 'components/button', '--product', 'acme')}`);
      unlock();

      return sketch.variants.map((variant) => ({ variant, change: 'variant a changes default' }));
    });

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(unlock).toHaveBeenCalled();
    expect(lines).toContain('another sketch ready run on components/button is going - wait for it');
    expect(lines).toContain('second run: 1');
  });

  it('commits its own auto-merge when the product was clean beside the sketch', async () => {
    const target = acme();
    const lines = output();
    const git = gitRepo(target);

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );
    await sameButton(target);

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('Committed: feat(repo): Merge components/button, no visible change');
    expect(lines.filter((line) => line.startsWith('  et design commit-hunks'))).toEqual([]);
    expect(git('log', '-1', '--format=%s').stdout.trim()).toBe(
      'feat(repo): Merge components/button, no visible change',
    );
    expect(git('status', '--porcelain', '--', DESIGN_DIR).stdout).toBe('');
  });

  it('leaves its auto-merge uncommitted when a shared file was dirty before', async () => {
    const target = acme();
    const lines = output();
    const git = gitRepo(target);
    const merged = join(target, DESIGN_DIR, 'acme/merged.json');

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );
    writeFileSync(merged, '{}\n');
    await sameButton(target);

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('No visible change in any state: merged components/button automatically.');
    expect(lines).toContain('  et design commit-hunks .ethlete/design/acme/merged.json --part components/button');
    expect(git('log', '-1', '--format=%s').stdout.trim()).toBe('base');
  });

  const newButton = (target: string) =>
    write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'R',
      '--note',
      'n',
      '--product',
      'acme',
    );

  it('prints a NOTE on ready when a variant declares instant state switches', async () => {
    const target = acme();
    const lines = output();
    const variantFile = join(target, DESIGN_DIR, 'acme/sketches/components-button/a/components/button/button.ts');

    await newButton(target);
    writeFileSync(
      variantFile,
      readFileSync(variantFile, 'utf8').replace('render:', "instant: 'No motion by design.',\n  render:"),
    );
    await write(target, 'ready', 'components/button', '--product', 'acme');

    expect(lines).toContain(
      'NOTE components/button a: components/button declares instant state switches (no motion between its states): No motion by design.',
    );
  });

  it('refuses ready on open points the variant adds and lists the ones the merged part already has', async () => {
    const target = acme();
    const lines = output();
    const variantFile = join(target, DESIGN_DIR, 'acme/sketches/components-button/a/components/button/button.ts');
    const actual = await actualSketchOpenPoints();
    const inherited =
      'NOTE components/button a: components/button: no controls declared; 2 missing motions (default -> long, long -> default) (inherited from the merged part)';

    vi.mocked(sketchOpenPointsOf).mockImplementation(actual);
    await newButton(target);
    writeFileSync(
      variantFile,
      readFileSync(variantFile, 'utf8').replace(
        "long: { label: 'Play from the beginning' }",
        "$&, wide: { label: 'Go' }",
      ),
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines).toContain(inherited);
    expect(lines.at(-1)).toBe(
      'components/button a: components/button: 4 missing motions (default -> wide, long -> wide, wide -> default, wide -> long)\ncomponents/button adds open points - close them before ready',
    );
    lines.length = 0;
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.at(-1)).toBe('check ok - ready will refuse 1 (see above)');
    expect(lines).toContain(
      'ready will refuse: components/button a: components/button: 4 missing motions (default -> wide, long -> wide, wide -> default, wide -> long)',
    );
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'in progress' });

    writeFileSync(variantFile, readFileSync(variantFile, 'utf8').replace(", wide: { label: 'Go' }", ''));

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(inherited);

    vi.mocked(sketchOpenPointsOf).mockImplementation(() => ({ added: [], inherited: [] }));
  });

  it('counts a state the variant draws busy as ongoing work in check and ready', async () => {
    const target = acme();
    const lines = output();
    const busyRender = {
      issues: [],
      warnings: [],
      grids: [],
      drawn: [],
      busy: [
        {
          product: 'acme',
          part: 'components/button',
          state: 'long',
          sketch: { target: 'components/button', variant: 'a' },
        },
      ],
    };
    const loop =
      "components/button a: components/button: no looping motion in long (add to motions: long: { from: 'long', to: 'long' })";

    vi.mocked(sketchOpenPointsOf).mockImplementation(await actualSketchOpenPoints());
    await newButton(target);
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    vi.mocked(renderIssuesOf).mockResolvedValueOnce(busyRender);

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(`ready will refuse: ${loop}`);

    vi.mocked(renderIssuesOf).mockResolvedValueOnce(busyRender);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toBe(`${loop}\ncomponents/button adds open points - close them before ready`);

    vi.mocked(sketchOpenPointsOf).mockImplementation(() => ({ added: [], inherited: [] }));
  });

  it('refuses ready on every open point of a new part', async () => {
    const target = acme();
    const lines = output();

    vi.mocked(sketchOpenPointsOf).mockImplementation(await actualSketchOpenPoints());
    await write(
      target,
      'new',
      'components/new-part',
      '--variants',
      'a',
      '--round',
      'New',
      '--note',
      'new',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/new-part', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toMatch(
      /^components\/new-part a: components\/new-part: no controls declared[^\n]*\ncomponents\/new-part adds open points - close them before ready$/,
    );

    vi.mocked(sketchOpenPointsOf).mockImplementation(() => ({ added: [], inherited: [] }));
  });

  it('refuses ready on a render issue and keeps the sketch in progress', async () => {
    const target = acme();
    const lines = output();

    await newButton(target);
    vi.mocked(renderIssuesOf).mockResolvedValueOnce({
      issues: [
        {
          rule: 'OVERFLOW',
          product: 'acme',
          part: 'components/button',
          state: 'default',
          size: 'phone',
          path: '#root > button',
          detail: 'sticks out',
          sketch: { target: 'components/button', variant: 'a' },
        },
      ],
      warnings: [],
      grids: [],
      drawn: [],
    });

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.join('\n')).toContain('OVERFLOW');
    expect(lines.join('\n')).toContain('components/button has problems - fix them before ready');
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'in progress' });
  });

  it('does not let a render issue in a rejected variant block ready', async () => {
    const target = acme();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'R',
      '--note',
      'n',
      '--product',
      'acme',
    );
    await write(target, 'reject', 'components/button', '--variant', 'a', '--product', 'acme');
    vi.mocked(renderIssuesOf).mockImplementationOnce(async ({ jobs }) => ({
      issues: jobs
        .filter((job) => job.sketch?.variant === 'a')
        .map((job) => ({
          rule: 'CONTROL-PART-INPUT',
          product: 'acme',
          part: 'components/button',
          state: 'default',
          size: 'phone',
          path: '#root > button',
          detail: 'clipped',
          sketch: job.sketch,
        })),
      warnings: [],
      grids: [],
      drawn: [],
    }));

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
  });

  it('accepts ready with a SKIPPED line when the browser is unavailable', async () => {
    const target = acme();
    const lines = output();

    await newButton(target);
    vi.mocked(renderIssuesOf).mockResolvedValueOnce({ unavailable: 'no playwright' });

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain('RENDER CHECK SKIPPED - no playwright');
  });

  it('refuses ready while a variant does not load, and keeps the sketch in progress', async () => {
    const target = acme();
    const lines = output();

    vi.mocked(variantsThatDoNotLoad).mockResolvedValueOnce([
      'variant a components/button does not load: exports is not defined',
    ]);

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'R',
      '--note',
      'n',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.join('\n')).toContain('does not load: exports is not defined');
    expect(lines.join('\n')).not.toContain('components/button is ready');
    vi.mocked(variantsThatDoNotLoad).mockResolvedValueOnce([
      'variant a components/button does not load: exports is not defined',
    ]);
    lines.length = 0;
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.at(-1)).toBe('check ok - ready will refuse 1 (see above)');
    expect(lines).toContain(
      'ready will refuse: components/button variant a components/button does not load: exports is not defined',
    );
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'in progress' });
  });

  it('check fails ROUND-NOT-READY on a drawn sketch left in progress, and passes once it is ready', async () => {
    const target = acme();
    const lines = output();
    const problem =
      'ROUND-NOT-READY components/button: round r1 is drawn but still in progress - run `design sketch ready components/button`';

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines).toContain(problem);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    lines.length = 0;

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).not.toContain(problem);
  });

  it('check prints the problems the product part has now as before lines, and does not fail on them', async () => {
    const target = acme();
    const lines = output();

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    vi.mocked(renderIssuesOf).mockClear();
    vi.mocked(renderIssuesOf).mockResolvedValueOnce({
      issues: [],
      warnings: [],
      grids: [],
      drawn: [],
      before: [
        {
          rule: 'OVERFLOW',
          product: 'acme',
          part: 'components/button',
          state: 'default',
          size: 'phone',
          path: '#root > button',
          detail: 'sticks out',
          sketch: null,
        },
      ],
    });
    lines.length = 0;

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(vi.mocked(renderIssuesOf).mock.calls[0]?.[0].before).toEqual([
      { product: 'acme', part: 'components/button' },
    ]);
    expect(lines).toContain(
      'components/button before: OVERFLOW acme components/button default at phone: #root > button - sticks out',
    );
  });

  it('report --done refuses a drawn round that is neither ready nor on hold', async () => {
    const target = acme();
    const lines = output();

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );

    expect(await write(target, 'report', 'components/button', '--variant', 'a', '--done', '--product', 'acme')).toBe(1);
    expect(lines.join('\n')).toContain('ROUND-NOT-READY components/button: round r1 is drawn');

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(await write(target, 'report', 'components/button', '--variant', 'a', '--done', '--product', 'acme')).toBe(0);
  });

  it('check does not fail ROUND-NOT-READY while ready would refuse', async () => {
    const target = acme();
    const lines = output();

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    vi.mocked(identicalRenderLines).mockResolvedValueOnce(['components/button variant b draws like a']);

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.some((line) => line.includes('ROUND-NOT-READY'))).toBe(false);
  });

  it('refuses ready while a sample draws different marks in two states, and check warns of it', async () => {
    const target = acme();
    const lines = output();
    const drift =
      'SAMPLE-MARK-DRIFT components/button a components/button: elements/cell "a hover" draws same=false in narrow but same=true in merged - give it the same marks in every state, or another id where the state shows another sample';

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    vi.mocked(sampleMarkDriftLines).mockResolvedValueOnce([drift]);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toBe(
      `${drift}\ncomponents/button draws one sample with different marks - align them before ready`,
    );

    vi.mocked(sampleMarkDriftLines).mockResolvedValueOnce([drift]);
    lines.length = 0;

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(`ready will refuse: ${drift}`);
    expect(lines.at(-1)).toBe('check ok - ready will refuse 1 (see above)');
  });

  it('refuses ready while a variant adds nothing visible, and check warns of it', async () => {
    const target = acme();
    const lines = output();
    const same =
      'components/button variant b draws the same pixels as variant a in every state (default, long) - it adds nothing visible: change it or reject it';

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    vi.mocked(identicalRenderLines).mockResolvedValueOnce([same]);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toBe(`${same}\ncomponents/button draws variants alike - fix them before ready`);

    vi.mocked(identicalRenderLines).mockResolvedValueOnce([same]);
    lines.length = 0;

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(`ready will refuse: ${same}`);
    expect(lines.at(-1)).toBe('check ok - ready will refuse 1 (see above)');
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'in progress' });
  });

  it('refuses ready and warns in check while a lone variant draws no changed state, unless --no-visible-change', async () => {
    const target = acme();
    const lines = output();
    const line =
      'NO-CHANGED-STATE variant a of components/button draws no state that differs from the design - draw the state the sketch is about (for a marker sketch: draw the missing state), or pass --no-visible-change to sketch ready when the sketch must change no pixel';

    vi.spyOn(console, 'warn').mockImplementation((entry: unknown) => void lines.push(String(entry)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--note',
      'n',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockImplementation(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toBe(
      `${line}\ncomponents/button draws a variant with no changed state - draw it before ready`,
    );

    lines.length = 0;

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(`ready will refuse: ${line}`);
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'in progress' });

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('No visible change in any state: merged components/button automatically.');
  });

  it('refuses ready on the unchanged variant of a sketch whose other variant changes, also with --no-visible-change', async () => {
    const target = acme();
    const lines = output();

    vi.spyOn(console, 'warn').mockImplementation((entry: unknown) => void lines.push(String(entry)));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockResolvedValue([
      { variant: 'a', change: 'variant a changes default' },
      { variant: 'b', change: null },
    ]);

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(1);
    expect(lines.at(-1)).toBe(
      'NO-CHANGED-STATE variant b of components/button draws no state that differs from the design - draw the state the sketch is about (for a marker sketch: draw the missing state)\ncomponents/button draws a variant with no changed state - draw it before ready',
    );
  });

  it('opens one sketch on several targets and merges them all by itself when no state shows a change', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );

    expect(
      await write(
        target,
        'new',
        'components/button',
        '--override',
        'elements/hero',
        '--variants',
        'a',
        '--round',
        'Same',
        '--note',
        'no change',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(lines).toContain(
      `  a: ${join(DESIGN_DIR, 'acme/sketches/components-button/a/components/button/button.ts')}, ${join(DESIGN_DIR, 'acme/sketches/components-button/a/elements/hero/hero.ts')}  assets: ${join(DESIGN_DIR, 'acme/sketches/components-button/a/assets')}/`,
    );
    expect(await write(target, 'ready', 'elements/hero', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(lines).toContain('No visible change in any state: merged components/button, elements/hero automatically.');
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
    expect(JSON.parse(readFileSync(join(product, 'merged.json'), 'utf8'))).toMatchObject({
      'components/button': { decidedBy: 'auto: no visible change' },
      'elements/hero': { decidedBy: 'auto: no visible change' },
    });
  });

  it('names in preview and ready each part a shared/ edit reaches', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');
    const hero = join(product, 'elements/hero/hero.ts');

    mkdirSync(join(product, 'shared'));
    writeFileSync(join(product, 'shared/tone.ts'), 'export const tone = 1;\n');
    writeFileSync(
      hero,
      `import { tone } from '@shared/tone';\n${readFileSync(hero, 'utf8')}\nexport const t = tone;\n`,
    );
    await write(
      target,
      'new',
      'foundations/palette',
      '--variants',
      'a',
      '--round',
      'Tone',
      '--note',
      'n',
      '--product',
      'acme',
    );
    mkdirSync(join(product, 'sketches/foundations-palette/shared'));
    writeFileSync(join(product, 'sketches/foundations-palette/shared/tone.ts'), 'export const tone = 2;\n');

    expect(await run(target, 'preview', 'foundations/palette', 'a', '--product', 'acme')).toBe(0);
    expect(lines).toContain('a shared/ edit reaches: elements/hero');
    expect(await write(target, 'ready', 'foundations/palette', '--product', 'acme')).toBe(0);
    expect(lines).toContain('variant a: a shared/ edit reaches elements/hero');
  });

  it('runs the check and the auto merge again on a sketch that is already ready', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    await write(
      target,
      'new',
      'components/button',
      '--override',
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
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button is still ready');

    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
    expect(existsSync(join(product, 'sketches/components-button'))).toBe(false);
  }, 30_000);

  it('keeps a sketch ready when a state shows a change and names why', async () => {
    const target = acme();
    const lines = output();
    await write(
      target,
      'new',
      'components/button',
      '--override',
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
    expect(lines.pop()).toBe('auto-merge skipped: variant a changes default');
  });

  it('refuses ready while a variant with a pixel diff has no shot viewed since its last edit', async () => {
    const target = acme();
    const lines = output();
    const actual = await vi.importActual<typeof import('./system/sketch/viewed-shots')>('./system/sketch/viewed-shots');

    vi.mocked(unviewedShotLinesOf).mockImplementation(actual.unviewedShotLinesOf);
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'Diff',
      '--note',
      'changes',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockResolvedValue([{ variant: 'a', change: 'variant a changes default' }]);

    const sketch = () => {
      const found = findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      });

      if (!found || typeof found === 'string') throw new Error('no sketch');

      return found;
    };

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()?.split('\n')).toEqual([
      `SHOT-NOT-VIEWED variant a changes default - variant a: no shot of it was viewed since its last edit: view ${join(target, 'node_modules/.design-explore/shots/acme-components-button-a.png')} after ` +
        '`et design shot components/button --states --variants --variant a --product acme`, or GET /__design/shot?product=acme&part=components/button&sketch=components/button&variant=a&state=<state>',
      'components/button draws a pixel diff - view its shot before ready',
    ]);
    expect(sketch().status).toBe('in progress');
    expect(
      new Set(
        ['a', 'b', 'c', undefined].map((variant) =>
          shotFileOf({ target, product: 'acme', part: 'components/button', variants: variant ? [variant] : [] }),
        ),
      ).size,
    ).toBe(4);

    const shot = shotFileOf({ target, product: 'acme', part: 'components/button', variants: ['a'] });

    mkdirSync(dirname(shot), { recursive: true });
    writeFileSync(shot, 'drawn');
    recordShotViewed({ target, sketch: sketch(), variant: 'a', shot });
    writeFileSync(join(sketch().dir, 'a/components/button/button.css'), '.et-button { color: red; }\n');

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);

    recordShotViewed({ target, sketch: sketch(), variant: 'a', shot });

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(sketch().status).toBe('ready');
    expect(lines.pop()).toBe('auto-merge skipped: variant a changes default');
  });

  it('refuses ready on a viewed record without a shot the CLI drew of the current content', async () => {
    const target = acme();
    const lines = output();
    const actual = await vi.importActual<typeof import('./system/sketch/viewed-shots')>('./system/sketch/viewed-shots');

    vi.mocked(unviewedShotLinesOf).mockImplementation(actual.unviewedShotLinesOf);
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--round',
      'Diff',
      '--note',
      'changes',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockResolvedValue([{ variant: 'a', change: 'variant a changes default' }]);

    const sketch = () => {
      const found = findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      });

      if (!found || typeof found === 'string') throw new Error('no sketch');

      return found;
    };
    const ready = async () => {
      const code = await write(target, 'ready', 'components/button', '--product', 'acme');

      return { code, reason: code === 0 ? null : (lines.pop()?.split('\n')[0]?.split(': view ')[0] ?? null) };
    };
    const shot = shotFileOf({ target, product: 'acme', part: 'components/button', variants: ['a'] });
    const viewedFile = join(target, 'node_modules/.design-explore/viewed-shots');
    const unviewed = {
      code: 1,
      reason: 'SHOT-NOT-VIEWED variant a changes default - variant a: no shot of it was viewed since its last edit',
    };

    expect(await ready()).toEqual(unviewed);

    recordShotViewed({ target, sketch: sketch(), variant: 'a', shot });

    expect(await ready()).toEqual(unviewed);

    mkdirSync(dirname(shot), { recursive: true });
    writeFileSync(shot, 'drawn');
    recordShotViewed({ target, sketch: sketch(), variant: 'a', shot });
    writeFileSync(viewedShotFileOf({ target, sketch: sketch(), variant: 'a' }), 'drawn over');

    expect(await ready()).toEqual({
      code: 1,
      reason:
        'SHOT-NOT-VIEWED variant a changes default - variant a: the shot it was viewed in is gone or was drawn over, so view the shot again',
    });

    for (const file of readdirSync(viewedFile).filter((name) => name.endsWith('.json')))
      writeFileSync(join(viewedFile, file), JSON.stringify({ a: variantContentHashOf(sketch(), 'a') }));

    expect(await ready()).toEqual({
      code: 1,
      reason:
        'SHOT-NOT-VIEWED variant a changes default - variant a: its viewed record predates shot hashes, so view the shot again',
    });

    recordShotViewed({ target, sketch: sketch(), variant: 'a', shot });

    expect(await ready()).toEqual({ code: 0, reason: null });
  });

  it('keeps a variant viewed after a later shot of another variant rewrites the same sheet file', async () => {
    const target = acme();
    const actual = await vi.importActual<typeof import('./system/sketch/viewed-shots')>('./system/sketch/viewed-shots');

    vi.mocked(unviewedShotLinesOf).mockImplementation(actual.unviewedShotLinesOf);
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'Diff',
      '--note',
      'changes',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockResolvedValue([
      { variant: 'a', change: 'variant a changes default' },
      { variant: 'b', change: 'variant b changes default' },
    ]);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);

    const found = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    });

    if (!found || typeof found === 'string') throw new Error('no sketch');

    const sheet = shotFileOf({ target, product: 'acme', part: 'components/button' });

    mkdirSync(dirname(sheet), { recursive: true });
    writeFileSync(sheet, 'sheet of a');
    recordShotViewed({ target, sketch: found, variant: 'a', shot: sheet });
    writeFileSync(sheet, 'sheet of b');
    recordShotViewed({ target, sketch: found, variant: 'b', shot: sheet });

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
  });

  it('readies a sketch whose variants draw no pixel diff without a viewed shot', async () => {
    const target = acme();
    const actual = await vi.importActual<typeof import('./system/sketch/viewed-shots')>('./system/sketch/viewed-shots');

    vi.mocked(unviewedShotLinesOf).mockImplementation(actual.unviewedShotLinesOf);
    vi.mocked(variantChangesShown).mockResolvedValueOnce([
      { variant: 'a', change: null },
      { variant: 'b', change: null },
    ]);
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'Same',
      '--note',
      'none',
      '--product',
      'acme',
    );

    expect(await write(target, 'ready', 'components/button', '--no-visible-change', '--product', 'acme')).toBe(0);
  });

  it('skips automatic merge for a new part without comparing shots', async () => {
    const target = acme();
    const lines = output();
    await write(
      target,
      'new',
      'components/new-part',
      '--variants',
      'a',
      '--round',
      'New',
      '--note',
      'new',
      '--product',
      'acme',
    );
    vi.mocked(variantChangesShown).mockClear();

    expect(await write(target, 'ready', 'components/new-part', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('auto-merge skipped: new part, the user merges');
    expect(variantChangesShown).not.toHaveBeenCalled();
  });

  it('names an unknown command and prints the usage', async () => {
    const lines = output();

    expect(await run(acme(), 'nope')).toBe(2);
    expect(lines[0]).toBe('unknown sketch command "nope"');
    expect(lines[1]).toContain('usage: et design sketch new <layer>/<name> [<layer>/<name>…] --variants a,b');
  });

  it("refuses a flag of another sketch command and lists only the command's own flags", async () => {
    const lines = output();

    expect(await run(acme(), 'ready', 'components/button', '--fix', '--by', 'x', '--product', 'acme')).toBe(2);
    expect(lines[0]).toBe('unknown flag --fix (flags: --by, --product, --no-visible-change)');
  });

  it('edits the title and note of a round and lists the rounds', async () => {
    const target = acme();
    const lines = output();
    const round = (...argv: string[]) => write(target, 'round', 'components/button', ...argv, '--product', 'acme');

    await write(
      target,
      'new',
      'components/button',
      '--override',
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
    expect(await run(target, 'list', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('  r1  Pill or square  a, b  - a clearly won');
    expect(round('r1', '--drops', 'empty, long')).toBe(0);
    expect(lines.pop()).toBe('components/button round r1: Pill or square - a clearly won - drops empty, long');
    expect(round('r1', '--drops', '')).toBe(0);
    expect(lines.pop()).toBe('components/button round r1: Pill or square - a clearly won');
  });

  it('says --product when report finds more than one product', async () => {
    const lines = output();

    expect(await write(acme(), 'report', 'components/button', '--variant', 'a', 'phone')).toBe(1);
    expect(lines.pop()).toContain('--product');
  });

  it('refuses every write without --by', async () => {
    const target = acme();
    const lines = output();

    for (const argv of [
      ['new', 'components/button', '--override', '--variants', 'a,b'],
      ['variant', 'components/button', 'c', '--from', 'a'],
      ['report', 'components/button', '--variant', 'a', 'phone'],
      ['ready', 'components/button'],
      ['rebase', 'components/button'],
      ['merge', 'components/button', '--note', 'x'],
      ['discard', 'components/button'],
      ['reject', 'components/button', '--variant', 'a'],
      ['reopen', 'components/button', '--variant', 'a'],
    ]) {
      expect(await run(target, ...argv, '--product', 'acme')).toBe(2);
      expect(lines).toContain(
        `sketch ${argv[0]} needs --by <model id>: the exact model id the coordinator gave you, e.g. claude-opus-5-5. Never guess it.`,
      );
    }

    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
  });

  it('sets the note of one variant, and refuses an unknown sketch or variant', async () => {
    const target = acme();
    const lines = output();
    const note = (...argv: string[]) => write(target, 'note', ...argv, '--product', 'acme');

    await write(target, 'new', 'elements/hero', '--variants', 'a,b', '--product', 'acme');

    expect(note('elements/hero', 'b', 'tighter', 'header')).toBe(0);
    expect(lines.pop()).toBe('elements/hero variant b: tighter header');
    expect(
      (
        findSketch({
          productDir: join(target, DESIGN_DIR, 'acme'),
          product: 'acme',
          sketch: { layer: 'elements', name: 'hero' },
        }) as Sketch
      ).variantInfo['b']?.note,
    ).toBe('tighter header');
    expect(note('elements/hero', 'z', 'x')).toBe(1);
    expect(lines.pop()).toBe('elements/hero has no variant "z" - it has a, b');
    expect(note('elements/nope', 'a', 'x')).toBe(1);
    expect(note('elements/hero', 'a')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch note <layer>/<name> [<variant>] <text>');
  });

  it('rejects and reopens a variant, keeps the history and prints the stored state', async () => {
    const target = acme();
    const lines = output();
    const sketchOf = () =>
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }) as Sketch;

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');

    expect(await write(target, 'reject', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toContain('usage: sketch reject <layer>/<name> --variant <key>');
    expect(await write(target, 'reject', 'components/button', '--variant', 'a', '--product', 'acme')).toBe(0);
    expect(lines.splice(-2)).toEqual([
      'components/button variant a: rejected',
      `  rejected by the agent at ${sketchOf().rejections?.['a']?.[0]?.decidedAt}`,
    ]);
    expect(
      await run(
        target,
        'reject',
        'components/button',
        '--variant',
        'a',
        '--reason',
        'too loud',
        '--by',
        'designer',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(lines.pop()).toContain('(reason by the designer): too loud');
    expect(await run(target, 'list')).toBe(0);
    expect(lines.slice(-2)[0]).toBe('acme  components/button  in progress  a, b, rejected a');
    expect(
      await run(
        target,
        'reopen',
        'components/button',
        '--variant',
        'a',
        '--reason',
        'worth a look',
        '--by',
        'designer',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(lines.splice(-3).map((line) => line.replace(/ at \d\S+?Z/u, ''))).toEqual([
      'components/button variant a: live',
      '  rejected by the agent (reason by the designer): too loud',
      '  reopened by the designer: worth a look',
    ]);
    expect(await write(target, 'reopen', 'components/button', '--variant', 'a', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button variant a is not rejected');
    expect(sketchOf().rejections?.['a']).toEqual([
      {
        by: 'agent',
        decidedAt: expect.any(String),
        reason: 'too loud',
        reasonBy: 'designer',
        reopened: { by: 'designer', decidedAt: expect.any(String), reason: 'worth a look' },
      },
    ]);
  });

  describe('withdraw', () => {
    afterEach(() => {
      vi.mocked(identicalRenders).mockReset().mockResolvedValue([]);
      vi.mocked(identicalRenderLines).mockReset().mockResolvedValue([]);
    });

    const opened = async () => {
      const target = acme();
      const lines = output();

      await write(
        target,
        'new',
        'components/button',
        '--override',
        '--variants',
        'a,b',
        '--note',
        'n',
        '--product',
        'acme',
      );

      return { target, lines };
    };
    const withdraw = (target: string, ...rest: string[]) =>
      run(target, 'withdraw', 'components/button', '--variant', 'b', '--product', 'acme', ...rest);
    const twinOfA = { variant: 'b', sibling: 'a', line: 'components/button variant b draws like variant a' };
    const sketchOf = (target: string) =>
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }) as Sketch;

    it('refuses --by designer', async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([twinOfA]);

      expect(await withdraw(target, '--by', 'designer')).toBe(1);
      expect(lines.at(-1)).toContain('not designer');
      expect(sketchOf(target).rejections).toBeUndefined();
    });

    it("refuses another agent's variant", async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([twinOfA]);

      expect(await withdraw(target, '--by', 'gpt-5.6-sol')).toBe(1);
      expect(lines.at(-1)).toContain('was not drawn by gpt-5.6-sol');
      expect(sketchOf(target).rejections).toBeUndefined();
    });

    it('refuses a variant that does not draw like a sibling', async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([]);

      expect(await withdraw(target, '--by', 'claude-opus-5-5')).toBe(1);
      expect(lines.at(-1)).toContain('does not draw the same pixels as a sibling');
      expect(sketchOf(target).rejections).toBeUndefined();
    });

    it('refuses a variant that draws like the product only', async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([{ ...twinOfA, sibling: null }]);

      expect(await withdraw(target, '--by', 'claude-opus-5-5')).toBe(1);
      expect(lines.at(-1)).toContain('does not draw the same pixels as a sibling');
    });

    it('withdraws the variant, so ready stops refusing on it', async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([twinOfA]);
      vi.mocked(identicalRenderLines).mockImplementation(async ({ sketch }) =>
        sketch.variants.some((variant) => !sketch.rejections?.[variant]) && !sketch.rejections ? [twinOfA.line] : [],
      );

      expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
      expect(lines.at(-1)).toContain('draws variants alike');
      expect(await withdraw(target, '--by', 'claude-opus-5-5')).toBe(0);
      expect(lines.at(-1)).toBe('withdrew components/button variant b (identisch mit a)');
      expect(sketchOf(target).rejections?.['b']).toEqual([
        {
          by: 'agent',
          decidedAt: expect.any(String),
          reason: 'identisch mit a',
          reasonBy: 'agent',
          status: 'withdrawn',
          withdrawnBy: 'claude-opus-5-5',
        },
      ]);
      expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
      expect(lines.some((line) => line.includes('draws variants alike'))).toBe(true);
      expect(lines.at(-1)).not.toContain('draws variants alike');
      expect(await run(target, 'list')).toBe(0);
      expect(lines.join('\n')).toContain('withdrawn b');
    });

    it('says a new variant comes from a withdrawn one', async () => {
      const { target, lines } = await opened();

      vi.mocked(identicalRenders).mockResolvedValue([twinOfA]);

      expect(await withdraw(target, '--by', 'claude-opus-5-5')).toBe(0);
      expect(await write(target, 'variant', 'components/button', 'c', '--from', 'b', '--product', 'acme')).toBe(0);
      expect(lines.join('\n')).toContain('c: from withdrawn b');
      expect(await write(target, 'variant', 'components/button', 'd', '--from', 'a', '--product', 'acme')).toBe(0);
      expect(lines.join('\n')).not.toContain('d: from withdrawn');
    });
  });

  it('checks no withdrawn variant: it gets a NOTE line, and its render issues never fail the check', async () => {
    const target = acme();
    const lines = output();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    await write(target, 'hold', 'components/button', '--until', 'the round is picked', '--product', 'acme');
    vi.mocked(identicalRenders).mockResolvedValueOnce([
      { variant: 'b', sibling: 'a', line: 'components/button variant b draws like variant a' },
    ]);
    expect(
      await run(
        target,
        'withdraw',
        'components/button',
        '--variant',
        'b',
        '--product',
        'acme',
        '--by',
        'claude-opus-5-5',
      ),
    ).toBe(0);
    vi.mocked(renderIssuesOf).mockImplementationOnce(async ({ jobs }) => ({
      issues: jobs
        .filter((job) => job.sketch?.variant === 'b')
        .map((job) => ({
          rule: 'CLIPPED',
          product: job.product,
          part: 'components/button',
          state: 'default',
          size: 'fitted',
          path: 'button',
          detail: 'clipped',
          sketch: job.sketch,
        })),
      warnings: [],
      grids: [],
      drawn: [],
    }));

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.some((line) => line.includes('CLIPPED'))).toBe(false);
    expect(lines.some((line) => line.startsWith('NOTE components/button b: withdrawn'))).toBe(true);
  });

  it('checks no rejected variant either: it gets the same NOTE line', async () => {
    const target = acme();
    const lines = output();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    await write(target, 'hold', 'components/button', '--until', 'the round is picked', '--product', 'acme');
    expect(
      await run(target, 'reject', 'components/button', '--variant', 'b', '--by', 'designer', '--product', 'acme'),
    ).toBe(0);
    vi.mocked(renderIssuesOf).mockImplementationOnce(async ({ jobs }) => ({
      issues: jobs
        .filter((job) => job.sketch?.variant === 'b')
        .map((job) => ({
          rule: 'CLIPPED',
          product: job.product,
          part: 'components/button',
          state: 'default',
          size: 'fitted',
          path: 'button',
          detail: 'clipped',
          sketch: job.sketch,
        })),
      warnings: [],
      grids: [],
      drawn: [],
    }));

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.some((line) => line.includes('CLIPPED'))).toBe(false);
    expect(lines).toContain('NOTE components/button b: rejected, not checked');
  });

  it('refuses a reject with a --by that is neither designer nor a model id', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');

    expect(await run(target, 'reject', 'components/button', '--variant', 'a', '--by', 'tom', '--product', 'acme')).toBe(
      1,
    );
    expect(lines.at(-1)).toContain('use designer or a model id');
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      })?.['rejections' as never],
    ).toBeUndefined();
  });

  it('refuses to merge a rejected variant', async () => {
    const target = acme();
    const lines = output();
    const dir = join(target, DESIGN_DIR, 'acme/sketches/components-button');

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');

    const file = JSON.parse(readFileSync(join(dir, 'sketch.json'), 'utf8')) as Record<string, unknown>;

    writeFileSync(
      join(dir, 'sketch.json'),
      JSON.stringify({
        ...file,
        status: 'ready',
        decision: { kind: 'pick', variant: 'a', decidedAt: 'now' },
        rejections: { a: [{ by: 'designer', decidedAt: 'now', reason: 'too loud' }] },
      }),
    );

    expect(await write(target, 'merge', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button variant a is rejected by the designer: too loud - reopen it first');
    expect(existsSync(dir)).toBe(true);
  });

  it('reports on the variant --variant names and records the author', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');

    expect(await write(target, 'report', 'components/button', 'variant', 'b', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toContain(
      'usage: sketch report <layer>/<name> --variant <key> --by <model id> (<text> | --done)',
    );
    expect(await write(target, 'report', 'components/button', '--variant', 'c', 'phone', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no variant "c" - it has a, b');
    expect(
      await run(
        target,
        'report',
        'components/button',
        '--variant',
        'b',
        '--by',
        'gpt-5.6-sol',
        'phone',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(await write(target, 'report', 'components/button', '--variant', 'b', 'desktop', '--product', 'acme')).toBe(
      0,
    );
    expect(await run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].variantInfo).toEqual({
      a: { authors: ['claude-opus-5-5'], round: 'r1' },
      b: { authors: ['claude-opus-5-5', 'gpt-5.6-sol'], round: 'r1' },
    });
  });

  it('ends the live report of a variant with --done', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');
    await write(target, 'report', 'components/button', '--variant', 'b', 'phone', '--product', 'acme');

    const sketch = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    }) as Sketch;

    expect(await write(target, 'report', 'components/button', '--variant', 'a', '--done', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button variant a marked done');
    expect(readSketchReport({ checkout: target, sketch })?.variant).toBe('b');

    expect(await write(target, 'report', 'components/button', '--variant', 'b', '--done', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button variant b marked done');
    expect(readSketchReport({ checkout: target, sketch })).toBeNull();
  });

  it('refuses a new round without a note, and ready until the round has one', async () => {
    const target = acme();
    const lines = output();

    expect(
      await write(
        target,
        'new',
        'components/button',
        '--override',
        '--variants',
        'a,b',
        '--round',
        'Pill',
        '--product',
        'acme',
      ),
    ).toBe(1);
    expect(lines.pop()).toBe(
      '--round needs --note "<what the round shows>" - sketch ready refuses a round without a note',
    );
    expect(
      await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme'),
    ).toBe(0);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toContain('round r1 has no note - set it with: sketch round components/button r1 --note');
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void lines.push(String(line)));
    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('check ok - ready will refuse 1 (see above)');
    expect(lines.pop()).toMatch(/^ready will refuse: components\/button round r1 has no note - set it with:/u);
    expect(await write(target, 'round', 'components/button', 'r1', '--note', 'pill', '--product', 'acme')).toBe(0);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
  });

  it('rewrites the note of a round of a ready sketch with note --round and keeps it ready', async () => {
    const target = acme();
    const lines = output();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'Pill',
      '--note',
      'pill',
      '--product',
      'acme',
    );
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(write(target, 'note', 'components/button', '--round', 'r9', 'x', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no round "r9" - it has r1');
    expect(write(target, 'note', 'components/button', '--round', 'r1', 'Pille', 'rund', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button round r1: Pille rund');
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }),
    ).toMatchObject({ status: 'ready', rounds: [{ key: 'r1', note: 'Pille rund' }] });
  });

  it('names the next steps after sketch new, and says report --done is not needed yet', async () => {
    const target = acme();
    const lines = output();

    expect(
      await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme'),
    ).toBe(0);

    const next = lines.slice(lines.indexOf('Next:'));

    expect(next).toEqual([
      'Next:',
      expect.stringContaining('sketch report components/button --product acme --variant a --by <model id> "'),
      expect.stringContaining('sketch round components/button r1 --product acme --note'),
      '  sketch check components/button --product acme',
      '  shot components/button --states --variants --product acme   look at it: ready refuses a pixel diff without a viewed shot',
      '  sketch ready components/button --product acme --by <model id>',
      expect.stringMatching(/sketch report .* --done .*none is needed now/u),
      expect.stringContaining('et design commit-hunks <file> --part components/button'),
      THEMING_TEXT,
    ]);
  });

  it('warns of a class two stylesheets of one part define, and still readies', async () => {
    const target = acme();

    output();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );

    const folder = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button');
    const ts = join(folder, 'button.ts');

    writeFileSync(join(folder, 'extra.css'), '.acme-button { color: red; }');
    writeFileSync(join(folder, 'button.css'), '.acme-button { color: blue; }');
    writeFileSync(
      ts,
      `import extra from './extra.css?inline';\n${readFileSync(ts, 'utf8')}\nexport const extraStyles = extra;\n`,
    );

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('b: WARNING components/button: .acme-button is defined in'),
    );
  });

  it('takes a held sketch out of ready, refuses ready with the until text, and readies it after release', async () => {
    const target = acme();
    const lines = output();
    const productDir = join(target, DESIGN_DIR, 'acme');
    const sketch = { layer: 'components', name: 'button' } as const;
    const statusOf = () => (findSketch({ productDir, product: 'acme', sketch }) as Sketch).status;

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--note',
      'n',
      '--product',
      'acme',
    );
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(statusOf()).toBe('ready');

    expect(
      await write(target, 'hold', 'components/button', '--until', 'the radius token lands', '--product', 'acme'),
    ).toBe(0);
    expect(lines.pop()).toBe(
      'components/button is held until: the radius token lands - back in progress, out of the merge queue',
    );
    expect(statusOf()).toBe('in progress');

    expect(await run(target, 'list', '--product', 'acme')).toBe(0);
    expect(lines).toContain('acme  components/button  in progress  a, held until: the radius token lands');

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'components/button is held until: the radius token lands - make the change, then run `et design sketch release components/button --by <name>`',
    );
    expect(statusOf()).toBe('in progress');

    expect(await write(target, 'release', 'components/button', '--product', 'acme')).toBe(0);
    expect(findSketch({ productDir, product: 'acme', sketch })).not.toHaveProperty('hold');
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(statusOf()).toBe('ready');
  });

  it('refuses ready while a variant drops a state of the part', async () => {
    const target = acme();
    const lines = output();
    const button = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button/button.ts');

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    writeFileSync(button, readFileSync(button, 'utf8').replace(/, long: \{[^}]*\}/u, ''));

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'components/button b: STATES .ethlete/design/acme/sketches/components-button/b/components/button/button.ts: drops the state long that components/button has in acme - a variant keeps every state of the part\ncomponents/button has problems - fix them before ready',
    );
  });

  it('refuses ready and fails check while the closure of a variant keeps an unused import', async () => {
    const target = acme();
    const lines = output();
    const button = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button/button.ts');

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    writeFileSync(button, `import { readFileSync } from 'fs';\n${readFileSync(button, 'utf8')}`);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'components/button b: UNUSED .ethlete/design/acme/sketches/components-button/b/components/button/button.ts: imports readFileSync but never uses it - remove the import\ncomponents/button has problems - fix them before ready',
    );
    lines.length = 0;
    expect(await run(target, 'check', 'components/button', '--fix', '--product', 'acme')).toBe(1);
    expect(lines).toContain(
      'components/button b: UNUSED .ethlete/design/acme/sketches/components-button/b/components/button/button.ts: imports readFileSync but never uses it - remove the import',
    );
  });

  it('refuses ready and fails check while a variant is not formatted', async () => {
    const target = acme();
    const lines = output();
    const css = join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/button/button.css');

    rmSync(join(target, '.prettierignore'));
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    writeFileSync(css, `${readFileSync(css, 'utf8')}\n.acme-button   {   }\n`);

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.join('\n')).toContain('FORMAT');
    expect(lines.join('\n')).toContain('sketch check components/button --fix');
    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(1);
    lines.length = 0;
    await write(target, 'hold', 'components/button', '--until', 'the round is picked', '--product', 'acme');
    expect(await run(target, 'check', 'components/button', '--fix', '--product', 'acme')).toBe(0);
    expect(lines.join('\n')).not.toContain('FORMAT');
  }, 30_000);

  it('writes new and added variants and sketch.json in the format the checkout holds them to', async () => {
    const target = acme();
    const lines = output();
    const product = join(target, DESIGN_DIR, 'acme');

    rmSync(join(target, '.prettierignore'));
    writeFileSync(join(target, '.prettierrc'), '{ "printWidth": 40 }\n');
    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--product',
      'acme',
    );
    await write(target, 'hold', 'components/button', '--until', 'the round is picked', '--product', 'acme');
    await write(target, 'variant', 'components/button', 'c', '--from', 'a', '--product', 'acme');

    expect(await run(target, 'check', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.join('\n')).not.toContain('FORMAT');
    expect(readFileSync(join(product, 'sketches/components-button/sketch.json'), 'utf8')).toContain(
      '"authors": ["claude-opus-5-5"]',
    );
  }, 30_000);

  it('keeps the note --variant-note names in sketch.json and leaves the merged note in the part file', async () => {
    const target = acme();
    const lines = output();
    const fileOf = (variant: string) =>
      join(target, DESIGN_DIR, `acme/sketches/components-button/${variant}/components/button/button.ts`);

    expect(
      await write(
        target,
        'new',
        'components/button',
        '--override',
        '--variants',
        'a,b',
        '--variant-note',
        'z=x',
        '--product',
        'acme',
      ),
    ).toBe(1);
    expect(lines.pop()).toContain('--variant-note needs <variant>=<text>');
    expect(
      await write(
        target,
        'new',
        'components/button',
        '--override',
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

  it('lists the shared files a page sketch moves out of the part', async () => {
    const target = acme();
    const lines = output();
    const part = join(target, DESIGN_DIR, 'acme/components/button/shared');
    mkdirSync(part, { recursive: true });
    writeFileSync(join(part, 'data.ts'), 'export const rows = [];\n');
    await write(target, 'new', 'components/button', '--override', '--variants', 'a', '--product', 'acme');

    expect(lines.slice(lines.indexOf('Next:') - 2, lines.indexOf('Next:'))).toEqual([
      '  shared by every variant, imported as @shared/<path>; edit it here, not in a copy:',
      `    ${DESIGN_DIR}/acme/sketches/components-button/shared/data.ts`,
    ]);
  });

  it('takes the product that holds the sketch when --product is missing', async () => {
    const target = acme();
    const lines = output();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a',
      '--note',
      'n',
      '--product',
      'acme',
    );
    await write(target, 'hold', 'components/button', '--until', 'the round is picked', '--product', 'acme');

    expect(await write(target, 'variant', 'components/button', 'b', '--from', 'a')).toBe(0);
    expect(lines.pop()).toContain('acme/sketches/components-button/b/');
    expect(await run(target, 'check', 'components/button')).toBe(0);
    expect(await run(target, 'check')).toBe(0);
    expect(await write(target, 'variant', 'components/card', 'b', '--from', 'a')).toBe(1);
    expect(lines.pop()).toContain('more than one product - pass --product');
  }, 30_000);

  it('adds every variant of a comma list, the first one opening the round', async () => {
    const target = acme();
    const lines = output();
    const variant = (...argv: string[]) => write(target, 'variant', 'components/button', ...argv, '--product', 'acme');

    await write(
      target,
      'new',
      'components/button',
      '--override',
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
    expect(await run(target, 'list', '--json')).toBe(0);
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

    await run(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--note',
      'n',
      '--by',
      'gpt-5.6-sol',
      '--product',
      'acme',
    );
    await run(
      target,
      'variant',
      'components/button',
      'c',
      '--from',
      'a',
      '--by',
      'claude-opus-5-5',
      '--product',
      'acme',
    );
    await run(
      target,
      'variant',
      'components/button',
      'd',
      '--from',
      'a',
      '--by',
      'claude-opus-5-5',
      '--product',
      'acme',
    );

    const file = join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json');
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...stored, variantInfo: { ...stored.variantInfo, d: { round: 'r1' } } }));

    expect(await run(target, 'ready', 'components/button', '--by', 'gpt-5.6-terra', '--product', 'acme')).toBe(0);
    expect(await run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].variantInfo).toEqual({
      a: { authors: ['gpt-5.6-sol'], round: 'r1' },
      b: { authors: ['gpt-5.6-sol'], round: 'r1' },
      c: { authors: ['claude-opus-5-5'], round: 'r1' },
      d: { authors: ['gpt-5.6-terra'], round: 'r1' },
    });
  });

  it('names the start command when sketch variant finds no open sketch', async () => {
    const lines = output();

    expect(await write(acme(), 'variant', 'components/button', 'c', '--from', 'a', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      'NO SKETCH on components/button in acme - start one with: sketch new components/button --variants a,b,c --round "<title>"',
    );
  });

  it('stores the note sketch new takes as the note of the first round', async () => {
    const target = acme();
    const lines = output();

    await write(
      target,
      'new',
      'components/button',
      '--override',
      '--variants',
      'a,b',
      '--round',
      'Pill',
      '--note',
      'pill or square',
      '--product',
      'acme',
    );

    expect(await run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0].rounds).toEqual([{ key: 'r1', title: 'Pill', note: 'pill or square' }]);
  });

  it('adds a variant from another, in the running round or a new one', async () => {
    const target = acme();
    const lines = output();
    const variant = (...argv: string[]) => write(target, 'variant', 'components/button', ...argv, '--product', 'acme');

    await write(
      target,
      'new',
      'components/button',
      '--override',
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
    expect(await run(target, 'list', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')[0]).toMatchObject({
      variants: ['a', 'b', 'c', 'd'],
      rounds: [
        { key: 'r1', title: 'Pill or square', lost: 'the user wants a with b' },
        { key: 'r2', title: 'Combined', note: 'a with b' },
      ],
      variantInfo: { a: { round: 'r1' }, b: { round: 'r1' }, c: { round: 'r2' }, d: { round: 'r2' } },
    });
  });

  it('marks the open comments on the variant a new round starts from addressed in that round', async () => {
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

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');
    mkdirSync(comments, { recursive: true });

    const { createdAt } = findSketch({
      productDir: join(target, DESIGN_DIR, 'acme'),
      product: 'acme',
      sketch: { layer: 'components', name: 'button' },
    }) as Sketch;
    const onA = comment('on-a', { target: 'components/button', variant: 'a', createdAt });
    const onB = comment('on-b', { target: 'components/button', variant: 'b', createdAt });
    const onPart = comment('on-part');

    expect(await write(target, 'variant', 'components/button', 'c', '--from', 'b', '--product', 'acme')).toBe(1);
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
      await write(
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

    expect(await write(target, 'new', 'components/button', '--override', '--variants', 'a,b')).toBe(1);
    expect(lines.pop()).toBe('more than one product - pass --product <name>; config.json declares acme-base, acme.');
    expect(
      await write(
        target,
        'new',
        'components/button',
        '--override',
        '--variants',
        'a,b',
        '--note',
        'n',
        '--product',
        'acme',
      ),
    ).toBe(0);
    expect(lines.splice(lines.indexOf('Next:')).length).toBe(8);
    expect(lines.splice(-3)).toEqual([
      `components/button in progress: ${DESIGN_DIR}/acme/sketches/components-button with a, b`,
      `  a: ${DESIGN_DIR}/acme/sketches/components-button/a/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/a/assets/`,
      `  b: ${DESIGN_DIR}/acme/sketches/components-button/b/components/button/button.ts  assets: ${DESIGN_DIR}/acme/sketches/components-button/b/assets/`,
    ]);
    expect(await write(target, 'report', 'components/button', '--variant', 'b', 'phone', '--product', 'acme')).toBe(0);
    expect(await run(target, 'list')).toBe(0);
    expect(lines.slice(-2)).toEqual(['acme  components/button  in progress  a, b', '  r1    a, b  - n']);
    expect(await run(target, 'preview', 'components/button', 'a', '--product', 'acme', '--json')).toBe(0);
    expect(JSON.parse(lines.pop() ?? '')).toEqual({
      changed: ['components/button'],
      shared: [],
      affected: ['elements/hero', 'pages/home'],
    });
    expect(await write(target, 'merge', 'components/button', 'a', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe(
      'usage: sketch merge <layer>/<name> [--note <reason>] - it merges the variant the user picked',
    );
    expect(await write(target, 'merge', 'components/button', '--product', 'acme', '--note', 'x')).toBe(1);
    expect(lines.pop()).toBe(
      'components/button is in progress - mark it ready before a merge: design sketch ready components/button --by <model id> --product acme',
    );
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.splice(-2)).toEqual(['components/button is ready', 'auto-merge skipped: variant a changes default']);
    expect(await write(target, 'merge', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('components/button has no pick - the user picks a variant in Studio before a merge');
    expect(await write(target, 'rebase', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.pop()).toBe('components/button now compares with the product as it is');
    expect(await write(target, 'discard', 'components/button', '--product', 'acme')).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button'))).toBe(false);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe('NO SKETCH on components/button in acme');
  });

  it('names an agent pick a merge reuses, and drops it on rebase when no commit holds its merge', async () => {
    const target = acme();
    const lines = output();
    const sketchFile = join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json');
    const withPick = () =>
      writeFileSync(
        sketchFile,
        JSON.stringify({
          ...JSON.parse(readFileSync(sketchFile, 'utf8')),
          decision: { kind: 'pick', variant: 'b', decidedAt: '2026-11-01T00:00:00.000Z', by: 'claude-sonnet-5-5' },
        }),
      );

    expect(
      await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme'),
    ).toBe(0);
    withPick();
    expect(await write(target, 'merge', 'components/button', '--product', 'acme')).toBe(1);
    expect(lines).toContain(
      'REUSED the pick of variant b by claude-sonnet-5-5 from 2026-11-01T00:00:00.000Z, recorded before this merge',
    );
    expect(await write(target, 'rebase', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines).toContain(
      'DROPPED the pick of variant b by claude-sonnet-5-5 from 2026-11-01T00:00:00.000Z: no commit holds its merge',
    );
    expect(JSON.parse(readFileSync(sketchFile, 'utf8')).decision).toBeUndefined();
  });

  it('refuses to discard the old/new sketch of a direct edit', async () => {
    const target = acme();
    const lines = output();

    expect(
      await write(target, 'new', 'elements/hero@edit', '--variants', 'old,new', '--note', 'n', '--product', 'acme'),
    ).toBe(0);
    expect(await write(target, 'discard', 'elements/hero@edit', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toMatch(
      /^EDIT-DISCARD-REFUSED: elements\/hero@edit .* pick old to undo the edit or new to keep it$/u,
    );
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/elements-hero.edit'))).toBe(true);
  });

  it('checks each variant of the open sketches', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'elements/hero', '--variants', 'a,b', '--note', 'n', '--product', 'acme');
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.css'),
      '.acme-hero { color: #fff; }',
    );

    expect(await run(target, 'check', '--product', 'acme')).toBe(1);
    expect(lines.pop()).toBe(
      `elements/hero b: HARD-CODED-COLOUR ${DESIGN_DIR}/acme/sketches/elements-hero/b/elements/hero/hero.css: #fff outside foundations - use a foundations token`,
    );
  }, 120_000);

  it('reports a ready sketch whose variant changed since ready and leaves its sketch.json byte-equal', async () => {
    const target = acme();
    const warnings: string[] = [];

    output();
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    await write(target, 'new', 'elements/hero', '--variants', 'a', '--note', 'n', '--product', 'acme');

    const file = join(target, DESIGN_DIR, 'acme/sketches/elements-hero/sketch.json');
    const ready = {
      ...JSON.parse(readFileSync(file, 'utf8')),
      status: 'ready',
      readyContent: { a: 'judged-before' },
      mergeHold: { reason: 'r', at: '2026-11-11T00:00:00.000Z' },
    };

    writeFileSync(file, `${JSON.stringify(ready, null, 2)}\n`);

    const before = readFileSync(file, 'utf8');

    await run(target, 'check', 'elements/hero', '--product', 'acme');

    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(warnings).toContain(
      'READY-STALE elements/hero: a changed since sketch ready judged it - run `et design sketch ready elements/hero --product acme` to judge it again',
    );
  }, 120_000);

  it('keeps a ready sketch ready on sketch ready when its files equal the commit of a stale hash', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];
    const file = join(target, DESIGN_DIR, 'acme/sketches/components-button/sketch.json');

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    const git = gitRepo(target);

    writeFileSync(join(target, '.gitignore'), 'tsconfig.json\n');
    await sameButton(target);
    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    writeFileSync(
      file,
      `${JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), readyContent: { a: 'stale-hash' } }, null, 2)}\n`,
    );
    git('add', '.');
    git('commit', '-m', 'ready');

    expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);
    expect(lines.some((line) => String(line).includes('back to in progress'))).toBe(false);
    expect(lines).toContain('components/button is still ready');
    expect(JSON.parse(readFileSync(file, 'utf8')).readyContent.a).not.toBe('stale-hash');

    await run(target, 'check', 'components/button', '--product', 'acme');

    expect(warnings.filter((line) => line.startsWith('READY-STALE'))).toEqual([]);
  }, 120_000);

  it('fails a sketch whose embedded part changed in the product and names that part', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'pages/home', '--variants', 'a', '--note', 'n', '--product', 'acme');
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await run(target, 'check', '--product', 'acme')).toBe(1);
    expect(lines).toContain(
      'SKETCH-BASE-STALE acme pages/home: elements/hero changed since the sketch was drawn - bring each variant up to date, then run et design sketch rebase pages/home --product acme --by <model id>',
    );
  }, 120_000);

  it('warns without failing when the Aktuell column shows only placeholders', async () => {
    const target = acme();
    const warnings: string[] = [];

    output();
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    vi.mocked(aktuellPlaceholderWarnings).mockResolvedValueOnce([
      'elements/hero: Aktuell shows only placeholders: open "default" to compare',
    ]);
    await write(target, 'new', 'elements/hero', '--variants', 'a', '--note', 'n', '--product', 'acme');
    await write(target, 'hold', 'elements/hero', '--until', 'the round is picked', '--product', 'acme');

    expect(await run(target, 'check', '--product', 'acme')).toBe(0);
    expect(warnings).toContain('elements/hero: Aktuell shows only placeholders: open "default" to compare');
  }, 120_000);

  it('prints each problem that was there before as its own line per variant', async () => {
    const target = acme();
    const warnings: string[] = [];

    output();
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'),
      '.acme-hero { color: #fff; }\n.acme-hero-title { color: #000; }',
    );
    await write(target, 'new', 'elements/hero', '--variants', 'a,b', '--note', 'n', '--product', 'acme');

    await run(target, 'check', '--product', 'acme');

    const notes = warnings.filter((line) => line.startsWith('NOTE'));

    expect(notes).toHaveLength(4);
    expect(notes.filter((line) => line.startsWith('NOTE elements/hero a: '))).toHaveLength(2);
    expect(notes.filter((line) => line.startsWith('NOTE elements/hero b: '))).toHaveLength(2);
    expect(notes.every((line) => line.endsWith('(there before)') && line.includes('hero.css'))).toBe(true);
  }, 120_000);

  it('draws each variant of the open sketches and reports what breaks a render rule', async (context) => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'elements/hero', '--variants', 'a,b', '--note', 'n', '--product', 'acme');
    rmSync(join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.css'));
    writeFileSync(
      join(target, DESIGN_DIR, 'acme/sketches/elements-hero/b/elements/hero/hero.ts'),
      `import { definePart, drawing, html } from '@design-system';

export default definePart({
  note: 'A hero.',
  states: { default: {} },
  render: () => drawing({ body: html\`<button data-et-control="save" style="width: 60px">Save the draft now</button>\`, styles: '' }),
});
`,
    );

    vi.mocked(renderIssuesOf).mockImplementationOnce(await actualRender());

    const code = await run(target, 'check', '--product', 'acme');

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip('no browser');

    expect(code).toBe(1);
    expect(lines).toContain(
      'elements/hero b: WRAP acme elements/hero default at fitted: button[data-et-part=elements/hero] - "Save the draft now" breaks onto 4 lines; on purpose: data-et-skip="WRAP" on the element, or definePart({ checks: { skip: [\'WRAP\'] } })',
    );
    expect(lines).toContain('elements/hero a: elements/hero default at fitted ok');
    expect(lines).toContain('elements/hero b: elements/hero default at fitted WRAP');
  }, 120_000);

  it('refuses ready on a real render issue and honours data-et-skip', async (context) => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'elements/hero', '--variants', 'a', '--round', 'R', '--note', 'n', '--product', 'acme');
    wideHero(target, 'class="acme-hero"');
    vi.mocked(renderIssuesOf).mockImplementationOnce(await actualRender());

    const refused = await write(target, 'ready', 'elements/hero', '--product', 'acme');

    if (lines.some((line) => line.startsWith('RENDER CHECK SKIPPED'))) return context.skip('no browser');

    expect(refused).toBe(1);
    expect(lines.join('\n')).toContain('WRAP');
    expect(lines).toContain('elements/hero has problems - fix them before ready');

    wideHero(target, 'class="acme-hero" data-et-skip="WRAP"');
    vi.mocked(renderIssuesOf).mockImplementationOnce(await actualRender());
    vi.mocked(variantChangesShown).mockImplementationOnce(async ({ sketch }) =>
      sketch.variants.map((variant) => ({ variant, change: null })),
    );

    expect(await write(target, 'ready', 'elements/hero', '--no-visible-change', '--product', 'acme')).toBe(0);
  }, 120_000);

  describe('merge --variant --allowed-by', { timeout: 120_000 }, () => {
    const PLAN = 'plans/ethlete-studio/contrast.md Findings decisions';

    const readied = async (variants: string) => {
      const target = acme();
      const lines = output();

      await write(
        target,
        'new',
        'components/button',
        '--override',
        '--variants',
        variants,
        '--round',
        'R',
        '--note',
        'n',
        '--product',
        'acme',
      );
      expect(await write(target, 'ready', 'components/button', '--product', 'acme')).toBe(0);

      return { target, lines };
    };

    const sketchDir = (target: string) => join(target, DESIGN_DIR, 'acme/sketches/components-button');

    it("merges the only live variant without a pick and notes the plan in the part's merged.json entry", async () => {
      const { target, lines } = await readied('a');

      expect(
        await write(target, 'merge', 'components/button', '--variant', 'a', '--allowed-by', PLAN, '--product', 'acme'),
      ).toBe(0);
      expect(lines.pop()).toContain('merged components/button variant a into acme');
      expect(existsSync(sketchDir(target))).toBe(false);
      expect(readFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.ts'), 'utf8')).not.toContain(PLAN);
      expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
        'components/button': { decidedBy: `plan: ${PLAN}`, note: `merged without a pick: allowed by ${PLAN}` },
      });
    });

    it("notes the --note reason in merged.json and keeps the part's note", async () => {
      const { target } = await readied('a');
      const buttonFile = join(target, DESIGN_DIR, 'acme/components/button/button.ts');
      const noteLine = /note: .*/u.exec(readFileSync(buttonFile, 'utf8'))?.[0];

      expect(
        await write(
          target,
          'merge',
          'components/button',
          '--variant',
          'a',
          '--allowed-by',
          PLAN,
          '--note',
          'calmer',
          '--product',
          'acme',
        ),
      ).toBe(0);
      expect(/note: .*/u.exec(readFileSync(buttonFile, 'utf8'))?.[0]).toBe(noteLine);
      expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
        'components/button': { note: `merged without a pick: allowed by ${PLAN} - merged: calmer` },
      });
    });

    it('records --decided-by as who picked the variant, and refuses it with --allowed-by', async () => {
      const { target, lines } = await readied('a,b');
      const file = join(sketchDir(target), 'sketch.json');
      const sketch = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

      writeFileSync(file, JSON.stringify({ ...sketch, decision: { kind: 'pick', variant: 'a', decidedAt: 'now' } }));
      expect(
        write(
          target,
          'merge',
          'components/button',
          '--decided-by',
          'tom',
          '--allowed-by',
          PLAN,
          '--variant',
          'a',
          '--product',
          'acme',
        ),
      ).toBe(1);
      expect(lines.pop()).toContain('does not go with --allowed-by');
      expect(write(target, 'merge', 'components/button', '--decided-by', 'human', '--product', 'acme')).toBe(0);
      expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
        'components/button': { variant: 'a', decidedBy: 'human' },
      });
    });

    it('refuses a person name in --decided-by on merge and pick before any write', async () => {
      const { target, lines } = await readied('a,b');
      const file = join(sketchDir(target), 'sketch.json');
      const before = readFileSync(file, 'utf8');

      expect(
        await write(
          target,
          'pick',
          'components/button',
          '--variant',
          'b',
          '--decided-by',
          'tom in chat: b',
          '--product',
          'acme',
        ),
      ).toBe(1);
      expect(lines.pop()).toContain('"human"');
      expect(readFileSync(file, 'utf8')).toBe(before);

      expect(
        await write(
          target,
          'pick',
          'components/button',
          '--variant',
          'b',
          '--decided-by',
          'human in chat: b',
          '--product',
          'acme',
        ),
      ).toBe(0);
      const picked = readFileSync(file, 'utf8');

      expect(await write(target, 'merge', 'components/button', '--decided-by', 'tom', '--product', 'acme')).toBe(1);
      expect(lines.pop()).toContain('"human"');
      expect(readFileSync(file, 'utf8')).toBe(picked);
      expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
    });

    it('writes the --note over the part note with --replace-note', async () => {
      const { target } = await readied('a');
      const args = ['merge', 'components/button', '--variant', 'a', '--allowed-by', PLAN, '--product', 'acme'];

      expect(await write(target, ...args, '--replace-note')).toBe(1);
      expect(await write(target, ...args, '--note', 'Calmer button.', '--replace-note')).toBe(0);
      expect(readFileSync(join(target, DESIGN_DIR, 'acme/components/button/button.ts'), 'utf8')).toContain(
        "note: 'Calmer button.'",
      );
    });

    it('refuses a sketch with two live variants', async () => {
      const { target, lines } = await readied('a,b');

      expect(
        await write(target, 'merge', 'components/button', '--variant', 'a', '--allowed-by', PLAN, '--product', 'acme'),
      ).toBe(1);
      expect(lines.pop()).toContain('the user picks in Studio');
      expect(existsSync(sketchDir(target))).toBe(true);
    });

    it('refuses a key that is not the live variant', async () => {
      const { target, lines } = await readied('a');

      expect(
        await write(target, 'merge', 'components/button', '--variant', 'b', '--allowed-by', PLAN, '--product', 'acme'),
      ).toBe(1);
      expect(lines.pop()).toContain('not only "b"');
      expect(existsSync(sketchDir(target))).toBe(true);
    });

    it('refuses one flag without the other', async () => {
      const { target, lines } = await readied('a');

      expect(await write(target, 'merge', 'components/button', '--variant', 'a', '--product', 'acme')).toBe(1);
      expect(lines.pop()).toContain('go together');
      expect(await write(target, 'merge', 'components/button', '--allowed-by', PLAN, '--product', 'acme')).toBe(1);
      expect(lines.pop()).toContain('go together');
      expect(existsSync(sketchDir(target))).toBe(true);
    });

    it('records the pick the designer gave in chat as Studio does, so merge --decided-by goes through', async () => {
      const { target, lines } = await readied('a,b');
      const said = 'human in chat: nimm b';

      expect(await write(target, 'merge', 'components/button', '--decided-by', 'human', '--product', 'acme')).toBe(1);
      expect(lines.pop()).toContain('has no pick');
      expect(
        await write(target, 'pick', 'components/button', '--variant', 'b', '--decided-by', said, '--product', 'acme'),
      ).toBe(0);
      expect(JSON.parse(readFileSync(join(sketchDir(target), 'sketch.json'), 'utf8'))).toMatchObject({
        decision: { kind: 'pick', variant: 'b', comment: said, by: 'designer', pid: process.pid },
      });
      expect(await write(target, 'merge', 'components/button', '--decided-by', 'human', '--product', 'acme')).toBe(0);
      expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
        'components/button': { variant: 'b', decidedBy: 'human' },
      });
    });

    it('refuses a pick of an unknown variant, and one without the words', async () => {
      const { target, lines } = await readied('a,b');
      const pick = (...argv: string[]) => write(target, 'pick', 'components/button', ...argv, '--product', 'acme');

      expect(await pick('--variant', 'z', '--decided-by', 'human in chat: z')).toBe(1);
      expect(lines.pop()).toContain('has no variant "z"');
      expect(await pick('--variant', 'a')).toBe(1);
      expect(lines.pop()).toContain('usage: sketch pick');
      expect(JSON.parse(readFileSync(join(sketchDir(target), 'sketch.json'), 'utf8')).decision).toBeUndefined();
    });
  });

  it('refuses a pick on a sketch that is not ready', async () => {
    const target = acme();
    const lines = output();

    await write(target, 'new', 'components/button', '--override', '--variants', 'a,b', '--product', 'acme');

    expect(
      await write(
        target,
        'pick',
        'components/button',
        '--variant',
        'a',
        '--decided-by',
        'human in chat: a',
        '--product',
        'acme',
      ),
    ).toBe(1);
    expect(lines.pop()).toContain('a variant is picked once it is ready');
  });
});

describe('sketch covers (ADR 0222)', () => {
  const acmeWrite = (target: string, ...argv: string[]) => write(target, ...argv, '--product', 'acme');
  const coversOf = (target: string) =>
    (
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }) as Sketch
    ).covers;

  it('sets the covered states and regions, keeps them through another write, and clears them', async () => {
    const target = acme();
    const lines = output();

    expect(
      await acmeWrite(target, 'new', 'components/button', '--variants', 'a,b', '--override'),
      lines.join('\n'),
    ).toBe(0);
    expect(await acmeWrite(target, 'covers', 'components/button', 'default', 'hover@0,0,20,10')).toBe(0);
    expect(lines.pop()).toBe(
      'components/button covers the compare DIFFs of default, hover@0,0,20,10 while it is open (ADR 0222)',
    );
    expect(await acmeWrite(target, 'note', 'components/button', 'a', 'the built look')).toBe(0);
    expect(coversOf(target)).toEqual(['default', 'hover@0,0,20,10']);
    expect(await acmeWrite(target, 'covers', 'components/button')).toBe(0);
    expect(lines.pop()).toBe('components/button covers no compare DIFF');
    expect(coversOf(target)).toBeUndefined();
  });

  it('refuses a broken region and a call without --by', async () => {
    const target = acme();
    const lines = output();

    expect(await acmeWrite(target, 'new', 'components/button', '--variants', 'a', '--override'), lines.join('\n')).toBe(
      0,
    );
    expect(await acmeWrite(target, 'covers', 'components/button', 'hover@0,0,20')).toBe(1);
    expect(lines.pop()).toContain('has no region');
    expect(await run(target, 'covers', 'components/button', 'default', '--product', 'acme')).toBe(2);
    expect(coversOf(target)).toBeUndefined();
  });
});

describe('sketch covers with several targets', () => {
  const acmeWrite = (target: string, ...argv: string[]) => write(target, ...argv, '--product', 'acme');
  const coversOf = (target: string) =>
    (
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'button' },
      }) as Sketch
    ).covers;

  it('refuses a bare state with exit 2, takes the qualified form, and a one-target sketch takes both', async () => {
    const target = acme();
    const lines = output();

    expect(await acmeWrite(target, 'new', 'components/button', '--variants', 'a', '--override'), lines.join('\n')).toBe(
      0,
    );
    expect(await acmeWrite(target, 'covers', 'components/button', 'default', 'components/button:hover')).toBe(0);
    expect(coversOf(target)).toEqual(['default', 'components/button:hover']);
    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'components/card')).toBe(0);
    expect(await acmeWrite(target, 'covers', 'components/button', 'default')).toBe(2);
    expect(lines.pop()).toContain('names no part');
    expect(await acmeWrite(target, 'covers', 'components/button', 'components/other:default')).toBe(2);
    expect(lines.pop()).toContain('does not target');
    expect(await acmeWrite(target, 'covers', 'components/button', 'components/card:default@0,0,2,2')).toBe(0);
    expect(coversOf(target)).toEqual(['components/card:default@0,0,2,2']);
  });
});

describe('sketch target add', () => {
  const acmeWrite = (target: string, ...argv: string[]) => write(target, ...argv, '--product', 'acme');

  const start = async () => {
    const target = acme();
    const lines = output();

    expect(
      await acmeWrite(target, 'new', 'components/button', '--variants', 'a,b', '--override'),
      lines.join('\n'),
    ).toBe(0);
    lines.length = 0;

    return { target, lines };
  };

  it('adds a part to targets, seeds it into each variant, and list shows it', async () => {
    const { target, lines } = await start();

    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'components/card')).toBe(0);
    expect(
      findSketch({
        productDir: join(target, DESIGN_DIR, 'acme'),
        product: 'acme',
        sketch: { layer: 'components', name: 'card' },
      }),
    ).toMatchObject({
      targets: ['components/button', 'components/card'],
    });
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button/b/components/card/card.ts'))).toBe(
      true,
    );
    lines.length = 0;
    expect(await run(target, 'list', '--product', 'acme')).toBe(0);
    expect(lines[0]).toContain('components/button (+ components/card)');
  });

  it('refuses a duplicate, a part another sketch holds, and a bad path', async () => {
    const { target, lines } = await start();

    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'components/button')).toBe(1);
    expect(lines.pop()).toContain('targets components/button already');
    expect(await acmeWrite(target, 'new', 'components/card', '--variants', 'a')).toBe(0);
    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'components/card')).toBe(1);
    expect(lines.pop()).toContain('components/card already has an open sketch');
    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'nonsense')).toBe(1);
    expect(await acmeWrite(target, 'target', 'add', 'components/nothing', 'components/x')).toBe(1);
  });
});

describe('sketch target remove', () => {
  const acmeWrite = (target: string, ...argv: string[]) => write(target, ...argv, '--product', 'acme');
  const jsonOf = (target: string, folder: string) =>
    readFileSync(join(target, DESIGN_DIR, 'acme/sketches', folder, 'sketch.json'), 'utf8');

  it('leaves the sketch.json as it was before the add', async () => {
    const target = acme();
    const lines = output();

    expect(
      await acmeWrite(target, 'new', 'components/button', '--variants', 'a,b', '--override'),
      lines.join('\n'),
    ).toBe(0);

    const before = jsonOf(target, 'components-button');

    expect(await acmeWrite(target, 'target', 'add', 'components/button', 'components/card')).toBe(0);
    expect(jsonOf(target, 'components-button')).not.toBe(before);
    expect(await acmeWrite(target, 'target', 'remove', 'components/button', 'components/card')).toBe(0);
    expect(jsonOf(target, 'components-button')).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/components-button/a/components/card'))).toBe(false);
  });

  it('refuses the main target and a part that is no target', async () => {
    const target = acme();
    const lines = output();

    expect(await acmeWrite(target, 'new', 'components/button', '--variants', 'a', '--override'), lines.join('\n')).toBe(
      0,
    );
    expect(await acmeWrite(target, 'target', 'remove', 'components/button', 'components/button')).toBe(1);
    expect(await acmeWrite(target, 'target', 'remove', 'components/button', 'components/card')).toBe(1);
    expect(lines.pop()).toContain('does not target components/card');
  });

  it('makes target add refuse a part the layer rule forbids, and writes nothing', async () => {
    const target = acme();
    const lines = output();

    expect(await acmeWrite(target, 'new', 'elements/hero', '--variants', 'a', '--override'), lines.join('\n')).toBe(0);

    const before = jsonOf(target, 'elements-hero');

    expect(await acmeWrite(target, 'target', 'add', 'elements/hero', 'elements/other')).toBe(1);
    expect(lines.pop()).toContain('UPWARD-DEPENDENCY');
    expect(jsonOf(target, 'elements-hero')).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/elements-hero/a/elements/other'))).toBe(false);
  });
});

describe('sketch new --name', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens a second sketch on a part and addresses each by its own id', async () => {
    const target = acme();
    const lines = output();
    const sketches = join(target, DESIGN_DIR, 'acme/sketches');
    const open = (...argv: string[]) => write(target, 'new', 'components/card', ...argv, '--product', 'acme');

    expect(await open('--variants', 'a')).toBe(0);
    expect(await open('--variants', 'x', '--name', 'alt')).toBe(0);
    expect(lines.some((line) => line.includes('sketch ready components/card@alt --product acme'))).toBe(true);
    expect(JSON.parse(readFileSync(join(sketches, 'components-card/sketch.json'), 'utf8')).target).toBe(
      'components/card',
    );
    expect(JSON.parse(readFileSync(join(sketches, 'components-card.alt/sketch.json'), 'utf8')).target).toBe(
      'components/card@alt',
    );
    expect(await open('--variants', 'y', '--name', 'alt')).toBe(1);
    expect(await write(target, 'report', 'components/card@alt', '--variant', 'x', '--done', '--product', 'acme')).toBe(
      0,
    );
    expect(await write(target, 'report', 'components/card@nope', '--variant', 'x', '--done', '--product', 'acme')).toBe(
      1,
    );
  });
});

describe('a sketches folder that holds only generated tsconfigs', { timeout: 120_000 }, () => {
  it('stays out of sketch list and gets one note in the check sweep', async () => {
    const target = acme();
    const leftover = join(target, DESIGN_DIR, 'acme/sketches/pages-sketches.change-crop');

    mkdirSync(join(leftover, 'a'), { recursive: true });
    writeFileSync(join(leftover, 'tsconfig.json'), '{}');
    writeFileSync(join(leftover, 'a/tsconfig.json'), '{}');

    const lines = output();

    expect(await run(target, 'list', '--product', 'acme')).toBe(0);
    expect(lines).toEqual(['no open sketch']);
    expect(await run(target, 'check', '--product', 'acme')).toBe(0);
    expect(lines).toContain(`NOTE ${DESIGN_DIR}/acme/sketches/pages-sketches.change-crop: holds no sketch, skipped`);
    expect(lines.filter((line) => line.includes('change-crop'))).toHaveLength(1);
  });
});
