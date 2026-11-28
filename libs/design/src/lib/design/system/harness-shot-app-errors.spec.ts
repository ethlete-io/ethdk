import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { appShotProblemOf, ShootStates } from './compare-command';
import { boxedHarnessShotOf, HarnessError } from './harness-shot';
import { ResolvedProduct } from './resolve-product';
import { comparedProblemsOf } from './slow-run';

const NG0950 =
  'NG0950: Input "hold" is required but no value is available yet. Find more at https://angular.dev/errors/NG0950';

const scripts: Record<string, string> = {
  ng0950: `
    class RuntimeError extends Error {}
    const error = new RuntimeError(${JSON.stringify(NG0950)});
    console.error('ERROR', error);
    console.error('ERROR', error);
  `,
  uncaught: `setTimeout(() => { throw new Error('boom in the part'); });`,
  noise: `
    console.log('[vite] connected.');
    console.info('Angular is running in development mode.');
    const missing = document.createElement('img');
    missing.src = '/missing.png';
    document.body.append(missing);
  `,
  sdk: `console.error('ERROR', new Error('ET0042: the menu has no trigger'));`,
};

const pageOf = (script: string) => `<!doctype html>
<style>body { margin: 0; } [data-design-harness-host] { display: block; }</style>
<div data-design-harness-host>
  <header style="width: 240px; height: 48px; display: flex; gap: 8px">
    <span>Pausiert</span>
    <button type="button" style="width: 32px; height: 32px"></button>
  </header>
</div>
<script>${script}</script>`;

describe('a harness page that logs an app error', () => {
  let browser: Browser | undefined;
  let server: Server | undefined;
  let base = '';

  beforeAll(async () => {
    const loaded = await chromiumOf(process.cwd());

    if (!loaded) {
      if (process.env['CI']) throw new Error('No playwright in CI');

      return;
    }

    browser = await loaded.chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;

      return undefined;
    });

    server = createServer((request, response) => {
      const script = scripts[new URL(request.url ?? '', 'http://x').pathname.slice(1)];

      if (script === undefined) response.writeHead(404).end();
      else response.writeHead(200, { 'content-type': 'text/html' }).end(pageOf(script));
    });
    await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
  });

  const stateShotOf = async (name: string) => {
    if (!browser) throw new Error('no browser');

    return boxedHarnessShotOf({ browser, url: `${base}/${name}` }).then(({ png }) => ({ app: png }), appShotProblemOf);
  };

  const problemsOf = async (name: string) => {
    const app = await stateShotOf(name);
    const shoot: ShootStates = async () => ({
      states: { paused: {} },
      shots: [{ state: 'paused', ...('app' in app ? { design: app.app, app: app.app } : app) }],
    });

    return comparedProblemsOf({
      target: '/nowhere',
      config: {},
      product: {} as ResolvedProduct,
      part: 'components/sketch-head',
      file: 'components/sketch-head/sketch-head.ts',
      url: 'u',
      shoot,
    });
  };

  it('reports the NG0950 a missing required input throws as one APP-ERROR of its state', async (context) => {
    if (!browser) return context.skip();

    expect(await problemsOf('ng0950')).toEqual([
      {
        rule: 'APP-ERROR',
        file: 'components/sketch-head/sketch-head.ts',
        message: `components/sketch-head paused: the app logged an error: ERROR RuntimeError: ${NG0950}`,
      },
    ]);
  });

  it('reports an uncaught error', async (context) => {
    if (!browser) return context.skip();

    expect((await problemsOf('uncaught')).map(({ rule, message }) => ({ rule, message }))).toEqual([
      { rule: 'APP-ERROR', message: 'components/sketch-head paused: the app logged an error: boom in the part' },
    ]);
  });

  it('ignores console logs, info and a failed resource load', async (context) => {
    if (!browser) return context.skip();

    expect(await problemsOf('noise')).toEqual([]);
  });

  it('leaves an ET-coded error to the SDK-error watch', async (context) => {
    if (!browser) return context.skip();

    await expect(stateShotOf('sdk')).rejects.toThrow(HarnessError);
  });
});
