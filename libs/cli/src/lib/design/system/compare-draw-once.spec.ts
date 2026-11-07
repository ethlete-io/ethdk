import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { designCompare } from './compare-command';
import { createDrawCount, drawnMoreThanOnce } from './draw-count.test';
import { encodePng } from './part-compare';
import { markPartReady, readyPartOf } from './part-ready';
import { markImplemented } from './part-task';
import { resolveProduct } from './resolve-product';
import { StartHarnessServer } from './harness-server';

const draws = createDrawCount();
const stores = new Map<string, Map<string, unknown>>();
const STATES = { default: {}, open: {}, closed: {} };
const PNG = encodePng({ width: 1, height: 1, data: Buffer.from([255, 0, 0, 255]) });
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

vi.mock('../browser', () => ({ chromiumOf: async () => ({}) }));
vi.mock('../serve', () => ({
  createDesignServer: async () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    shotStore: (dir: string) => stores.get(dir) ?? stores.set(dir, new Map()).get(dir),
    ssrLoadModule: async () => ({ default: { states: STATES } }),
  }),
}));
vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({}),
}));
vi.mock('../shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../shot')>()),
  createPartShooter: (options: { target: string; store: Map<string, unknown> }) => ({
    close: async () => undefined,
    pictureOf: async (address: {
      product: string;
      part: string;
      state: string;
      width: number | null;
      emptySlots: boolean;
      compose?: unknown;
    }) => {
      const { product, part, state, width, emptySlots, compose } = address;
      const key = [part, state, width ?? '', emptySlots ? '' : 'slots', compose ? JSON.stringify(compose) : '']
        .join(' ')
        .trim();
      const source = readFileSync(join(options.target, DESIGN_DIR, product, part, `${basename(part)}.ts`), 'utf8');
      const stored = `${key}\n${source}`;
      const picture = { markup: '<div></div>', png: PNG, marks: [] };

      if (options.store.has(stored)) return picture;

      draws.drawn('design', key);
      await tick();
      options.store.set(stored, picture);

      return picture;
    },
  }),
}));

const fakePage = () => ({
  goto: async () => undefined,
  setContent: async () => undefined,
  evaluate: async () => [],
  mouse: { move: async () => undefined },
  locator: () => ({ first: () => ({ waitFor: async () => undefined }), waitFor: async () => undefined }),
});

vi.mock('../thumb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../thumb')>()),
  createDrawQueue: () => ({
    close: async () => undefined,
    run: async (job: (browser: unknown) => unknown) =>
      job({ newContext: async () => ({ newPage: async () => fakePage(), close: async () => undefined }) }),
  }),
}));
vi.mock('./harness-shot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./harness-shot')>()),
  harnessShotOf: async ({ url }: { url: string }) => {
    const { searchParams } = new URL(url);

    draws.drawn('app', `${searchParams.get('part')} ${searchParams.get('state')}`);
    await tick();

    return PNG;
  },
}));
vi.mock('./pointer-focus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pointer-focus')>()),
  probePointerFocus: async () => null,
}));
vi.mock('./actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./actions')>()),
  pairElementsOf: () => ({ paired: [], missing: [] }),
}));

const PARTS = ['components/chip', 'components/badge'];

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-draw-once-'));

  for (const part of PARTS) {
    mkdirSync(join(target, DESIGN_DIR, 'app-a', part), { recursive: true });
    writeFileSync(
      join(target, DESIGN_DIR, 'app-a', part, `${basename(part)}.ts`),
      `export default definePart({ implements: 'libs/${basename(part)}.component.ts', states: ${JSON.stringify(STATES)} });\n`,
    );
  }

  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  const root = join(target, 'built-app');

  mkdirSync(root);
  writeFileSync(join(root, 'main.js'), 'app');

  return { target, root };
};

const compareOf = (target: string, root: string) => {
  const start: StartHarnessServer = async () => ({ url: 'http://127.0.0.1:50001', root, stop: async () => undefined });

  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => void lines.push(String(line)));

  return async (argv: string[]) => {
    draws.take();
    lines.length = 0;

    const code = await designCompare({ target, argv: [...argv, '--product', 'app-a'], invocation: 'et design', start });
    const drawn = draws.take();

    expect(drawnMoreThanOnce(drawn)).toEqual([]);

    return { code, drawn: [...drawn.keys()].sort(), lines };
  };
};

const pictures = (kind: 'design' | 'app', part: string) =>
  Object.keys(STATES).map((state) => `${kind} ${part} ${state}`);

describe('compare draws each picture at most once per run', () => {
  it('draws every design and app picture of a part once while the action check overlaps, and none again on a warm run', async () => {
    const { target, root } = checkout();
    const compare = compareOf(target, root);
    const chip = ['components/chip'];

    expect(await compare(chip)).toMatchObject({
      code: 0,
      drawn: [...pictures('app', 'components/chip'), ...pictures('design', 'components/chip')].sort(),
    });
    expect(await compare(chip)).toMatchObject({ code: 0, drawn: [] });
  });

  it('after a design edit draws the design pictures of the edited part once and no app picture', async () => {
    const { target, root } = checkout();
    const compare = compareOf(target, root);
    const chip = ['components/chip'];
    const source = join(target, DESIGN_DIR, 'app-a/components/chip/chip.ts');

    await compare(chip);
    writeFileSync(source, `${readFileSync(source, 'utf8')}// edited\n`);

    expect(await compare(chip)).toMatchObject({ code: 0, drawn: pictures('design', 'components/chip').sort() });
    expect(await compare(chip)).toMatchObject({ code: 0, drawn: [] });
  });

  it('after an app edit draws the app pictures once and no design picture', async () => {
    const { target, root } = checkout();
    const compare = compareOf(target, root);
    const chip = ['components/chip'];

    await compare(chip);
    writeFileSync(join(root, 'main.js'), 'app edited');

    expect(await compare(chip)).toMatchObject({ code: 0, drawn: pictures('app', 'components/chip').sort() });
  });

  it('--all draws every picture of each done part once', async () => {
    const { target, root } = checkout();
    const compare = compareOf(target, root);
    const product = () => resolveProduct({ target, name: 'app-a', config: {} });

    for (const part of PARTS) {
      markImplemented({ product: product(), part, states: STATES });

      const found = readyPartOf({ product: product(), part });

      await markPartReady({
        product: product(),
        part,
        hash: typeof found === 'string' ? found : found.hash,
        pointsOf: async () => [],
        actionsOf: async () => [],
      });
    }

    expect(await compare(['--all'])).toMatchObject({
      code: 0,
      drawn: PARTS.flatMap((part) => [...pictures('app', part), ...pictures('design', part)]).sort(),
    });
    expect(await compare(['--all'])).toMatchObject({ code: 0, drawn: [] });
  });
});
