import { cpSync, mkdtempSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter, dependentIdsOf } from './shot';
import { createSystemModules, productModuleIdOf } from './system/system-modules';

const goto = vi.fn<(url: string, options?: unknown) => Promise<void>>(async () => undefined);
const screenshot = vi.fn<(options: unknown) => Promise<Buffer>>(async () => Buffer.from('png'));
const newContext = vi.fn<(options: unknown) => Promise<unknown>>(async () => ({
  newPage: async () => ({
    goto,
    screenshot,
    evaluate: async () => true,
    locator: () => ({ first: () => ({ waitFor: async () => undefined }) }),
  }),
  close: async () => undefined,
}));
const chromium = { launch: async () => ({ newContext, close: async () => undefined }) } as never;
const withBrowser = async () => ({ chromium, from: 'playwright' });

const cwd = process.cwd();
const closing: (() => Promise<void>)[] = [];

beforeEach(() => vi.clearAllMocks());

afterEach(async () => {
  await Promise.all(closing.splice(0).map((close) => close()));
  process.chdir(cwd);
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-shot-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const config = readConfig(target) ?? {};
  const system = createSystemModules({ target, config });
  const shots = createPartShooter({ target, base: 'http://localhost:1', system, chromiumOf: withBrowser });

  closing.push(() => shots.close());

  return { target, config, shots };
};

const ask = (shots: ReturnType<typeof createPartShooter>, query: string) =>
  new Promise<{ status: number; type: string; body: unknown }>((done) => {
    const headers: Record<string, string> = {};
    const response = {
      statusCode: 200,
      setHeader: (name: string, value: string) => (headers[name] = value),
      end: (body: unknown) => done({ status: response.statusCode, type: headers['content-type'] ?? '', body }),
    };

    shots.middleware({ url: `/?${query}` } as IncomingMessage, response as unknown as ServerResponse);
  });

describe('createPartShooter', () => {
  it('draws a state at the preset width, at full height, under the asked theme', async () => {
    const { shots } = acme();
    const shot = await ask(shots, 'product=acme&part=components/card&state=long&preset=phone&surface=dark');

    expect(shot).toMatchObject({ status: 200, type: 'image/png' });
    expect(newContext).toHaveBeenCalledWith({ viewport: { width: 390, height: 844 } });
    expect(goto.mock.calls[0]?.[0]).toBe(
      'http://localhost:1/frame.html?product=acme&part=components%2Fcard&state=long&surface=dark',
    );
    expect(screenshot).toHaveBeenCalledWith({ fullPage: true, type: 'png' });
  });

  it('keeps one picture per part, state, preset and theme', async () => {
    const { shots } = acme();

    await ask(shots, 'product=acme&part=components/card&state=long&preset=phone');
    await ask(shots, 'product=acme&part=components/card&state=long&preset=phone');
    await ask(shots, 'product=acme&part=components/card&state=long&preset=desktop');
    await ask(shots, 'product=acme&part=components/card&state=long&preset=phone&color=brand');

    expect(screenshot).toHaveBeenCalledTimes(3);
  });

  it('drops the pictures of every part above a changed file, in the product that drew it', async () => {
    const { target, config, shots } = acme();
    const vite = await createDesignServer({ target, config, listen: false });

    closing.push(() => vite.close());

    const system = createSystemModules({ target, config });
    const pageIds = ['pages/home', 'elements/hero'].map((part) =>
      productModuleIdOf({ file: system.partOf({ product: 'acme', part })?.file ?? '', product: 'acme' }),
    );

    await Promise.all(pageIds.map((id) => vite.ssrLoadModule(id)));

    for (const part of ['pages/home', 'components/card', 'elements/hero']) {
      await ask(shots, `product=acme&part=${part}&state=default&preset=phone`);
    }

    const baseCardCss = join(target, DESIGN_DIR, 'acme-base/components/card/card.css');

    shots.forget(dependentIdsOf(vite.moduleGraph.getModulesByFile(baseCardCss) ?? []));
    screenshot.mockClear();

    for (const part of ['pages/home', 'components/card', 'elements/hero']) {
      await ask(shots, `product=acme&part=${part}&state=default&preset=phone`);
    }

    expect(goto.mock.calls.slice(-2).map(([url]) => new URL(url).searchParams.get('part'))).toEqual([
      'pages/home',
      'components/card',
    ]);
    expect(screenshot).toHaveBeenCalledTimes(2);
  });

  it('answers 400 without a product, part, state or preset, and 404 for one the product lacks', async () => {
    const { shots } = acme();

    expect((await ask(shots, 'product=acme&part=components/card&state=long')).status).toBe(400);
    expect((await ask(shots, 'product=acme&part=components/nope&state=long&preset=phone')).status).toBe(404);
    expect((await ask(shots, 'product=acme&part=components/card&state=long&preset=tv')).status).toBe(404);
    expect(screenshot).not.toHaveBeenCalled();
  });
});

describe('dependentIdsOf', () => {
  it('walks every importer once, also around a cycle', () => {
    type Node = { id: string | null; importers: Set<Node> };
    const node = (id: string | null): Node => ({ id, importers: new Set() });
    const [leaf, mid, top, unnamed] = [node('leaf'), node('mid'), node('top'), node(null)];

    leaf.importers.add(mid);
    mid.importers.add(top).add(unnamed);
    top.importers.add(mid);

    expect(dependentIdsOf([leaf]).sort()).toEqual(['leaf', 'mid', 'top']);
  });
});
