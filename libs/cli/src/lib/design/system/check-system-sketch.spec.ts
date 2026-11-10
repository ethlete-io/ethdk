import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { AddressInfo, createServer as createNetServer, Server } from 'net';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from '../check';
import { DESIGN_DIR, readConfig } from '../design-config';
import { createDesignServer } from '../serve';
import { markPartGo } from './part-go';
import { resolveProduct } from './resolve-product';
import { recordMerged } from './sketch/merged-parts';
import { createSketch, decideSketch, rebaseSketch, variantDirOf } from './sketch/sketch';
import { originOf } from './write-origin';
import { acme, output, withoutOpenPoints, withoutBrowserLines, renderWarningsOf } from './check-system.fixtures';

const probe = vi.hoisted(() => ({ port: null as number | null }));

vi.mock('net', async (original) => {
  const actual = await original<typeof import('net')>();
  const createServer = ((...args: Parameters<typeof actual.createServer>) => {
    const port = probe.port;

    if (port === null) return actual.createServer(...args);
    probe.port = null;

    return {
      once: () => undefined,
      listen: (_port: number, listening: () => void) => listening(),
      address: () => ({ port }),
      close: (closed: () => void) => closed(),
    };
  }) as typeof actual.createServer;

  return { ...actual, createServer };
});

describe('own design server', () => {
  it('listens on another port when its probed port is taken before it binds', async () => {
    const blocker: Server = createNetServer();

    await new Promise<void>((listening) => blocker.listen(0, 'localhost', listening));
    const taken = (blocker.address() as AddressInfo).port;
    const target = acme();

    probe.port = taken;
    const server = await createDesignServer({ target, config: readConfig(target) ?? {}, listen: true, port: 0 });

    try {
      await server.listen();

      expect((server.httpServer?.address() as AddressInfo).port).not.toBe(taken);
    } finally {
      await server.close();
      await new Promise((closed) => blocker.close(closed));
    }
  }, 60_000);
});

describe('checkDesign', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('warns of a merged part that changed outside a sketch, and passes', async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    recordMerged({ product: { dir: join(target, DESIGN_DIR, 'acme'), base: null }, parts: ['elements/hero'] });
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings).toEqual([
      expect.stringMatching(/^WARNING acme elements\/hero changed outside a sketch/),
      ...renderWarningsOf(lines),
    ]);
    expect(lines).toContain('ok');
  }, 60_000);

  it('warns once per product of decision files that differ from HEAD or are untracked, and passes', async () => {
    const target = acme();
    output();
    const warnings: string[] = [];
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
        cwd: target,
        stdio: 'ignore',
      });
    const dir = join(target, DESIGN_DIR, 'acme');

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    writeFileSync(join(dir, 'go.json'), '{}\n');
    git('init', '-q');
    git('add', '.');
    git('commit', '-q', '--no-verify', '-m', 'base');
    writeFileSync(join(dir, 'go.json'), '{ }\n');
    mkdirSync(join(dir, 'sketches/hero'), { recursive: true });
    writeFileSync(join(dir, 'sketches/hero/sketch.json'), '{}\n');
    writeFileSync(join(dir, 'sketches/hero/notes.md'), 'x\n');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings.filter((line) => line.includes('UNCOMMITTED-DECISIONS'))).toEqual([
      'WARNING UNCOMMITTED-DECISIONS acme: go.json, sketches/hero/sketch.json differ from HEAD - Studio or Tom ' +
        'commits them; an agent never commits go.json',
    ]);
  }, 60_000);

  it('checks only the part named as a positional, as --part does', async () => {
    const target = acme();
    const lines = output();
    const run = async (argv: string[]) => {
      lines.length = 0;
      const code = await checkDesign({ target, argv, invocation: 'et design' });

      return { code, lines: lines.filter((line) => !/^\[\d+\/\d+\] .* \d+s$/.test(line)) };
    };

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    const flagged = await run(['--part', 'components/button', '--product', 'acme']);

    expect(flagged.lines).toContain('HARD-CODED-COLOUR 0');
    expect(await run(['components/button', '--product', 'acme'])).toEqual(flagged);
    expect(await run(['components/button'])).toEqual(await run(['--part', 'components/button']));
  }, 60_000);

  it('rejects a positional part it cannot honour with a hint to --part', async () => {
    const target = acme();
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    expect(
      await checkDesign({ target, argv: ['elements/hero', '--part', 'pages/home'], invocation: 'et design' }),
    ).toBe(2);
    expect(await checkDesign({ target, argv: ['hero'], invocation: 'et design' })).toBe(2);
    expect(await checkDesign({ target, argv: ['--product', 'acme', 'elements/hero'], invocation: 'et design' })).toBe(
      2,
    );
    expect(errors).toEqual([
      expect.stringContaining('--part elements/hero'),
      expect.stringContaining('--part hero'),
      expect.stringContaining('--part elements/hero'),
    ]);
  }, 60_000);

  it('reports and lists only the part a positional names', async () => {
    const target = acme();
    const config = readConfig(target) ?? {};
    const product = resolveProduct({ target, name: 'acme', config: config.products?.['acme'] ?? {} });

    markPartGo({ product, part: 'elements/hero', by: 'tom', via: 'design go' });

    const lines = output();

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await checkDesign({ target, argv: ['components/button', '--product', 'acme'], invocation: 'et design' });

    expect(lines.filter((line) => line.includes('elements/hero'))).toEqual([]);
    expect(lines.at(-1)).toMatch(/^check complete: 1 part, /);
  }, 60_000);

  it('rejects an argument the check does not read', async () => {
    const target = acme();
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    expect(await checkDesign({ target, argv: ['--product', 'acme', '--bogus'], invocation: 'et design' })).toBe(2);
    expect(await checkDesign({ target, argv: ['--prodcut', 'acme'], invocation: 'et design' })).toBe(2);
    expect(
      await checkDesign({
        target,
        argv: ['--part', 'elements/hero', '--live', '--product', 'acme'],
        invocation: 'et design',
      }),
    ).toBe(2);
    expect(errors).toEqual([
      'check does not read --bogus - see et design check --help',
      'check does not read --prodcut - see et design check --help',
      'check does not read --part with --live - see et design check --help',
    ]);
  }, 60_000);

  it("warns of an export in a part's shared/ that nothing imports, and passes", async () => {
    const target = acme();
    const lines = output();
    const warnings: string[] = [];

    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => void warnings.push(String(line)));
    mkdirSync(join(target, DESIGN_DIR, 'acme/elements/hero/shared'));
    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/shared/data.ts'), 'export const rows = [];\n');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(warnings).toEqual([
      expect.stringMatching(
        /^WARNING UNUSED-EXPORT .*hero\/shared\/data\.ts: rows is exported, but nothing imports it/,
      ),
      ...renderWarningsOf(lines),
    ]);
    expect(lines).toContain('ok');
  }, 60_000);

  it('fails on a type error in a variant of an open sketch', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(
      join(variantDirOf(sketch, 'b'), 'elements/hero/hero.ts'),
      "const broken: number = 'text';\nexport default broken;\n",
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([
      expect.stringMatching(/^TYPE-ERROR .*sketches\/elements-hero\/b: \n[^]*TS2322/),
    ]);
  }, 60_000);

  it('fails when an old variant imports a name its sketch shared folder no longer exports', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['new', 'old'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    mkdirSync(join(sketch.dir, 'shared'), { recursive: true });
    writeFileSync(join(sketch.dir, 'shared/flows.ts'), "export const emptyCanvasOf = (): string => '';\n");
    const newHero = join(variantDirOf(sketch, 'new'), 'elements/hero/hero.ts');

    writeFileSync(
      newHero,
      `import { emptyCanvasOf } from '@shared/flows';\nemptyCanvasOf();\n${readFileSync(newHero, 'utf8')}`,
    );
    writeFileSync(
      join(variantDirOf(sketch, 'old'), 'elements/hero/hero.ts'),
      "import { emptyCanvas } from '@shared/flows';\nexport default emptyCanvas;\n",
    );

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'et design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([
      expect.stringMatching(/^TYPE-ERROR .*sketches\/elements-hero\/old: \n[^]*emptyCanvas/),
    ]);
  }, 60_000);

  it('fails while a part an open sketch replaces changed since the sketch, until the sketch is rebased', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(1);
    expect(withoutBrowserLines(lines)).toEqual([
      'SKETCH-BASE-STALE acme elements/hero: elements/hero changed since the sketch was drawn - bring each variant up to date, then run yarn design sketch rebase elements/hero --product acme --by <model id>',
    ]);

    rebaseSketch({ product, sketch });
    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(0);
    expect(lines).toContain('SKETCH-BASE-STALE 0');
  }, 60_000);

  it('reports a stale base on a picked sketch and skips a discarded one', async () => {
    const target = acme();
    const lines = output();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    if (typeof sketch === 'string') throw new Error(sketch);

    writeFileSync(join(target, DESIGN_DIR, 'acme/elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    const picked = decideSketch({
      sketch: { ...sketch, status: 'ready' },
      decision: { kind: 'pick', variant: 'a', ...originOf('spec') },
    });

    if (typeof picked === 'string') throw new Error(picked);

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(1);
    expect(lines).toContain('SKETCH-BASE-STALE 1');

    const discarded = decideSketch({ sketch: picked, decision: { kind: 'discard', ...originOf('spec') } });

    if (typeof discarded === 'string') throw new Error(discarded);

    lines.length = 0;

    expect(await checkDesign({ target, argv: ['--product', 'acme'], invocation: 'yarn design' })).toBe(0);
    expect(lines).toContain('SKETCH-BASE-STALE 0');
  }, 60_000);

  it('checks one product with --product', async () => {
    const lines = output();

    expect(await checkDesign({ target: acme(), argv: ['--product', 'acme'], invocation: 'et design' })).toBe(0);
    expect(
      withoutOpenPoints(lines).filter(
        (line) => !/^RENDER CHECK (SKIPPED|FAILED)/.test(line) && !line.startsWith('HINT '),
      ),
    ).toEqual(['ok']);
  }, 60_000);
});
