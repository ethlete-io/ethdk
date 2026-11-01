import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumOf } from '../browser';
import { SeenFrame, seeFrame } from './complete';
import { demoBackdropGapsOf } from './demo-backdrop';

const SURFACE = 'style="--et-surface-background: 20 30 40"';

const FRAMES: Record<string, string> = {
  backdrop: `<div id="root" ${SURFACE}><div class="demo" data-et-part="components/x" style="padding:8px;background-color:rgb(var(--et-surface-background))"><button data-et-control="go">Go</button></div></div>`,
  transparent: `<div id="root" ${SURFACE}><div class="demo" data-et-part="components/x" style="padding:8px"><button data-et-control="go">Go</button></div></div>`,
  ownSurface: `<div id="root" ${SURFACE}><div class="card" data-et-part="components/x" style="--et-surface-background: 60 70 80;background-color:rgb(var(--et-surface-background))"><button data-et-control="go">Go</button></div></div>`,
  ownFill: `<div id="root" ${SURFACE}><div class="chip" data-et-part="components/x" style="background-color:rgb(1 2 3)"><button data-et-control="go">Go</button></div></div>`,
  controlRoot: `<div id="root" ${SURFACE}><button data-et-part="components/x" data-et-control="go" style="background-color:rgb(var(--et-surface-background))">Go</button></div>`,
};

describe('demo backdrop check', () => {
  let close: () => Promise<void> = async () => undefined;
  const seen = new Map<string, SeenFrame>();

  beforeAll(async () => {
    const loaded = await chromiumOf(process.cwd());

    if (!loaded) {
      if (process.env['CI']) throw new Error('No playwright in CI');

      return;
    }

    const browser = await loaded.chromium.launch().catch((error: unknown) => {
      if (process.env['CI']) throw error;
    });

    if (!browser) return;

    const page = await browser.newPage();

    close = () => browser.close();

    for (const [name, markup] of Object.entries(FRAMES)) {
      await page.setContent(markup);

      const frame = (await page.evaluate(
        seeFrame({ discover: true, part: 'components/x', ownCss: [], controlParts: {}, clip: false }),
      )) as Omit<SeenFrame, 'state' | 'interaction'>;

      seen.set(name, { ...frame, state: name, interaction: null });
    }
  }, 60_000);

  afterAll(() => close());

  const gapsOf = (name: string) => demoBackdropGapsOf({ part: 'components/x', frames: [seen.get(name) as SeenFrame] });

  it('refuses a part root that paints the fill of the surface it sits on', (context) => {
    if (seen.size === 0) return context.skip('no browser');

    expect(gapsOf('backdrop')).toEqual([
      expect.objectContaining({
        code: 'DEMO-BACKDROP',
        target: 'components/x',
        detail: expect.stringContaining('div.demo'),
      }),
    ]);
  });

  it('passes a transparent root, a root on its own surface, an own fill and a control root', (context) => {
    if (seen.size === 0) return context.skip('no browser');

    for (const name of ['transparent', 'ownSurface', 'ownFill', 'controlRoot']) expect(gapsOf(name)).toEqual([]);
  });
});
