import { cpSync, mkdtempSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { createDesignServer } from './serve';
import { createPartShooter, dependentIdsOf } from './shot';
import { createSketch, parseTarget } from './system/sketch/sketch';
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

  it('draws a part as a sketch variant holds it when the address names the sketch and the variant', async () => {
    const { target, config, shots } = acme();
    const product = createSystemModules({ target, config }).productOf('acme');
    const parsed = parseTarget('components/button');

    if (!product || typeof parsed === 'string') throw new Error('no acme');

    createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

    const part = 'product=acme&part=elements/hero&state=default&preset=phone';

    expect(await ask(shots, `${part}&sketch=components/button&variant=b`)).toMatchObject({ status: 200 });
    expect(await ask(shots, `${part}&sketch=components/button&variant=a`)).toMatchObject({ status: 200 });
    expect(await ask(shots, part)).toMatchObject({ status: 200 });
    expect(goto.mock.calls.map(([url]) => new URL(url).search)).toEqual([
      '?product=acme&part=elements%2Fhero&state=default&sketch=components%2Fbutton&variant=b',
      '?product=acme&part=elements%2Fhero&state=default&sketch=components%2Fbutton&variant=a',
      '?product=acme&part=elements%2Fhero&state=default',
    ]);
    expect((await ask(shots, `${part}&sketch=components/button&variant=z`)).status).toBe(404);
  });

  it('answers 400 without a product, part, state or preset, and 404 for one the product lacks', async () => {
    const { shots } = acme();

    expect((await ask(shots, 'product=acme&part=components/card&state=long')).status).toBe(400);
    expect((await ask(shots, 'product=acme&part=components/nope&state=long&preset=phone')).status).toBe(404);
    expect((await ask(shots, 'product=acme&part=components/card&state=long&preset=tv')).status).toBe(404);
    expect(screenshot).not.toHaveBeenCalled();
  });
});

describe('createPartShooter for a call', () => {
  it('draws a variant at the asked width, at full height, under the asked theme', async () => {
    const { shots } = acme();
    const shot = await ask(shots, 'call=acme/login&variant=a&width=1280&color=brand');

    expect(shot).toMatchObject({ status: 200, type: 'image/png' });
    expect(newContext).toHaveBeenCalledWith({ viewport: { width: 1280, height: 800 } });
    expect(goto.mock.calls[0]?.[0]).toBe('http://localhost:1/frame.html?call=acme%2Flogin&variant=a&color=brand');
    expect(screenshot).toHaveBeenCalledWith({ fullPage: true, type: 'png' });
  });

  it('keeps one picture per variant, width and theme until a file of its call changes', async () => {
    const { shots } = acme();

    await ask(shots, 'call=acme/login&variant=a&width=1280');
    await ask(shots, 'call=acme/login&variant=a&width=1280');
    await ask(shots, 'call=acme/login&variant=a&width=390');
    await ask(shots, 'call=acme/other&variant=a&width=1280');
    expect(screenshot).toHaveBeenCalledTimes(3);

    shots.forgetCalls('acme/login/call.ts');
    await ask(shots, 'call=acme/login&variant=a&width=1280');
    await ask(shots, 'call=acme/other&variant=a&width=1280');
    expect(screenshot).toHaveBeenCalledTimes(4);

    shots.forgetCalls('acme/shared.ts');
    await ask(shots, 'call=acme/other&variant=a&width=1280');
    expect(screenshot).toHaveBeenCalledTimes(5);
  });

  it('answers 400 without a call, a variant or a positive whole width', async () => {
    const { shots } = acme();

    for (const query of ['call=acme/login&variant=a', 'variant=a&width=1280', 'call=acme/login&width=1280']) {
      expect((await ask(shots, query)).status).toBe(400);
    }

    for (const width of ['0', '-5', '12.5', 'wide']) {
      expect((await ask(shots, `call=acme/login&variant=a&width=${width}`)).status).toBe(400);
    }

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
