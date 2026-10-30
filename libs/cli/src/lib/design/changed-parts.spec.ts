import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PartsChange } from './changed-parts';
import { DESIGN_DIR, DesignConfig, readConfig } from './paths';
import { createDesignServer } from './serve';
import { COMMENT_EVENTS_PATH } from './studio-api';
import { createSketch, parseTarget } from './system/sketch/sketch';
import { createSystemModules, productModuleIdOf, SketchVariant } from './system/system-modules';

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const SKETCH_A = { target: 'components/card', variant: 'a' };

const serveAcme = async (options: { styles?: string[]; tokens?: string[] } = {}) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-changed-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const config = readConfig(target) ?? {};

  if (options.styles || options.tokens) {
    const acme = config.products?.['acme'] ?? {};

    config.products = {
      ...config.products,
      acme: {
        ...acme,
        ...(options.styles ? { styles: options.styles } : {}),
        ...(options.tokens ? { tokens: options.tokens } : {}),
      },
    };
    writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify(config));
  }

  const system = createSystemModules({ target, config });
  const product = system.productOf('acme');
  const parsed = parseTarget(SKETCH_A.target);

  if (!product || typeof parsed === 'string') throw new Error('no acme');

  createSketch({ product, sketch: parsed, variants: ['a', 'b'] });
  system.forget();

  const vite = await createDesignServer({ target, config, listen: false });

  closing.push(() => vite.close());

  const written: string[] = [];
  const response = { writeHead: () => response, write: (chunk: string) => written.push(chunk) };

  const listen = vite.middlewares.stack.find(({ route }) => route === COMMENT_EVENTS_PATH)?.handle as (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void;

  listen({ on: () => undefined } as unknown as IncomingMessage, response as unknown as ServerResponse);

  const draw = (product: string, part: string, sketch: SketchVariant | null = null) =>
    vite.ssrLoadModule(
      productModuleIdOf({ file: system.partOf({ product, part, sketch })?.file ?? '', product, sketch }),
    );

  const changes = () =>
    written.flatMap((chunk) => {
      const [event, data] = chunk.split('\n');

      return event === 'event: parts' ? [JSON.parse(data?.slice('data: '.length) ?? '') as PartsChange] : [];
    });

  const keysOf = (change: PartsChange | undefined) =>
    change && !change.all
      ? change.parts.map(({ product, part, sketch }) => [product, part, sketch?.variant ?? ''].join(' ')).sort()
      : change;

  return {
    target,
    config: config as DesignConfig,
    system,
    vite,
    draw,
    changes,
    keysOf,
    emit: (event: 'add' | 'change' | 'unlink', file: string) =>
      vite.watcher.emit(event, join(target, DESIGN_DIR, file)),
  };
};

describe('the parts event of the design server', () => {
  it('redraws a changed part, every part that imports it, and every sketch variant that shows it', async () => {
    const { draw, emit, changes, keysOf } = await serveAcme();

    await draw('acme', 'pages/home');
    await draw('acme', 'pages/home', SKETCH_A);

    emit('change', 'acme/components/button/button.ts');

    expect(changes()).toEqual([expect.objectContaining({ revision: 1, all: false })]);
    expect(keysOf(changes()[0])).toEqual([
      'acme components/button ',
      'acme components/button a',
      'acme components/card ',
      'acme components/card a',
      'acme elements/hero ',
      'acme elements/hero a',
      'acme pages/home ',
      'acme pages/home a',
    ]);
  });

  it("redraws only a sketch variant's parts when the variant's own file changes", async () => {
    const { draw, emit, changes, keysOf, system } = await serveAcme();

    await draw('acme', 'pages/home');
    await draw('acme', 'pages/home', SKETCH_A);

    const variantCard = system.partOf({ product: 'acme', part: 'components/card', sketch: SKETCH_A })?.file ?? '';

    emit('change', variantCard.slice(variantCard.indexOf(DESIGN_DIR) + DESIGN_DIR.length + 1));

    expect(keysOf(changes()[0])).toEqual(['acme components/card a', 'acme pages/home a']);
  });

  it('redraws every part drawn under a tokens stylesheet when it changes, though no part imports it', async () => {
    const { emit, changes, keysOf } = await serveAcme();

    emit('change', 'acme-base/foundations/tokens/tokens.css');

    expect(keysOf(changes()[0])).toEqual(
      expect.arrayContaining(['acme pages/home ', 'acme pages/home a', 'acme-base components/card ']),
    );
  });

  it('redraws every part drawn under any of the tokens parts a product names, though no part imports it', async () => {
    const { emit, changes, keysOf } = await serveAcme({ tokens: ['foundations/tokens', 'foundations/palette'] });

    emit('change', 'acme/foundations/palette/palette.css');

    expect(keysOf(changes()[0])).toEqual(expect.arrayContaining(['acme pages/home ', 'acme pages/home a']));
  });

  it('redraws only the importers of the fixtures', async () => {
    const { draw, emit, changes, keysOf } = await serveAcme();

    await draw('acme', 'pages/home');
    await draw('acme', 'foundations/palette');

    emit('change', 'acme/fixtures.ts');

    expect(keysOf(changes()[0])).toEqual(['acme elements/hero ', 'acme pages/home ']);
  });

  it('redraws a base part in every product that inherits it', async () => {
    const { draw, emit, changes, keysOf } = await serveAcme();

    await draw('acme', 'pages/home');
    await draw('acme-base', 'components/card');

    emit('change', 'acme-base/components/card/card.css');

    expect(keysOf(changes()[0])).toEqual(['acme components/card ', 'acme pages/home ', 'acme-base components/card ']);
  });

  it("redraws every part of a product, its sketch variants too, when one of the product's styles changes", async () => {
    const { emit, changes, keysOf, system } = await serveAcme({ styles: [`${DESIGN_DIR}/acme/styles.css`] });

    emit('change', 'acme/styles.css');

    const plain = (system.productOf('acme')?.parts ?? []).length;
    const keys = keysOf(changes()[0]) as string[];

    expect(keys.filter((key) => key.startsWith('acme-base'))).toEqual([]);
    expect(keys.filter((key) => key.endsWith(' '))).toHaveLength(plain);
    expect(keys.filter((key) => key.endsWith(' a'))).toHaveLength(plain);
    expect(keys.filter((key) => key.endsWith(' b'))).toHaveLength(plain);
  });

  it('redraws only the parts of a file, and their importers, that reaches the product styles as a Tailwind source', async () => {
    const { target, emit, changes, keysOf, vite, draw } = await serveAcme({
      styles: [`${DESIGN_DIR}/acme/styles.css`],
    });
    const styles = join(target, DESIGN_DIR, 'acme/styles.css');

    writeFileSync(join(target, DESIGN_DIR, 'acme/base.css'), '.base { color: red; }\n');
    writeFileSync(styles, "@import './base.css';\n@source './';\n@tailwind utilities;\n");
    await draw('acme', 'pages/home');
    await vite.transformRequest(productModuleIdOf({ file: styles, product: 'acme' }));

    expect(
      [...(vite.moduleGraph.getModulesByFile(join(target, DESIGN_DIR, 'acme/elements/hero/hero.ts')) ?? [])].some(
        (module) => [...module.importers].some((importer) => importer.file === styles),
      ),
    ).toBe(true);

    emit('change', 'acme/elements/hero/hero.ts');
    emit('change', 'acme/base.css');
    emit('change', 'acme/styles.css');

    const plain = (change: PartsChange | undefined) => (keysOf(change) as string[]).filter((key) => key.endsWith(' '));
    const every = plain(changes()[2]).length;

    expect(plain(changes()[0])).toEqual(['acme elements/hero ', 'acme pages/home ']);
    expect(plain(changes()[1])).toHaveLength(every);
    expect(every).toBeGreaterThan(2);
  });

  it('redraws all parts for config.json', async () => {
    const { emit, changes } = await serveAcme();

    emit('change', 'config.json');

    expect(changes()).toEqual([{ revision: 1, all: true }]);
  });

  it('redraws every part of the product, its sketch variants too, when a part file comes or goes', async () => {
    const { emit, changes, keysOf, system } = await serveAcme();

    emit('add', 'acme/components/badge/badge.ts');
    emit('unlink', 'acme/components/badge/badge.ts');

    const plain = (system.productOf('acme')?.parts ?? []).length;

    for (const change of changes()) {
      const keys = keysOf(change) as string[];

      expect(keys.filter((key) => key.startsWith('acme-base'))).toEqual([]);
      expect(keys.filter((key) => key.endsWith(' '))).toHaveLength(plain);
      expect(keys.filter((key) => key.endsWith(' a'))).toHaveLength(plain);
    }
    expect(changes()).toHaveLength(2);
  });

  it("draws a base part with the product's own tokens once they come, through the tokens stylesheet import", async () => {
    const { target, vite, emit, changes, keysOf } = await serveAcme();
    const design = join(target, DESIGN_DIR);
    const probe = join(design, 'acme-base/components/card/probe.ts');
    const tokens = join(design, 'acme/foundations/tokens');
    const load = async () =>
      ((await vite.ssrLoadModule(productModuleIdOf({ file: probe, product: 'acme' }))) as { default: string }).default;

    writeFileSync(probe, "import tokens from '@system/foundations/tokens.css?inline';\nexport default tokens;\n");

    expect(await load()).not.toContain('acme own');

    mkdirSync(tokens, { recursive: true });
    writeFileSync(join(tokens, 'tokens.ts'), "export default { note: '', states: {}, render: () => null };\n");
    writeFileSync(join(tokens, 'tokens.css'), ':root { --acme-own: 1; } /* acme own */\n');
    emit('add', 'acme/foundations/tokens/tokens.css');

    expect(await load()).toContain('acme own');
    expect(keysOf(changes()[changes().length - 1])).toContain('acme components/card ');
  });

  it('redraws the frames of the sketch variant whose folder a file comes to', async () => {
    const { emit, changes, keysOf } = await serveAcme();

    emit('add', 'acme/sketches/components-card/a/components/card/extra.css');

    const keys = keysOf(changes()[0]) as string[];

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key.endsWith(' a'))).toBe(true);
  });

  it('asks frames that show an error to reload for a file in no part folder', async () => {
    const { emit, changes } = await serveAcme();

    emit('add', 'acme/notes.md');
    emit('add', 'acme/sketches/components-card/notes.md');

    expect(changes()).toEqual([
      { revision: 1, all: false, parts: [], errored: true },
      { revision: 2, all: false, parts: [], errored: true },
    ]);
  });

  it('sends nothing for a file no frame draws, and leaves a comment to its own event', async () => {
    const { emit, changes } = await serveAcme();

    emit('change', 'acme/components/button/button.ts');
    emit('change', 'acme/comments/20260101T000000Z-ab12.json');

    expect(changes()).toEqual([]);
  });
});
