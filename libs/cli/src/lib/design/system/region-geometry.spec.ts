import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRegionsOnPage, designRegionsOf, regionDeltaLineOf, regionDeltasOf } from './region-geometry';

const pageOf = (inner: string) =>
  `<body style="margin:0"><main style="display:block;width:400px;height:300px">${inner}</main></body>`;

const FULL = pageOf('<canvas-view style="display:block;height:300px"></canvas-view>');

const SHORT_BOX = pageOf('<canvas-view style="display:block;height:280px"></canvas-view>');

const SHORT_CLIP = pageOf(
  '<div style="height:280px;overflow:hidden"><canvas-view style="display:block;height:300px"></canvas-view></div>',
);

const SELECTORS = [{ name: 'components/canvas-viewport', selector: 'canvas-view' }];

describe('region geometry', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  const regionsOf = async (html: string) => {
    const page = await (browser as Browser).newPage({ viewport: { width: 400, height: 300 } });

    try {
      await page.setContent(html);

      return await appRegionsOnPage({ page, host: 'main', selectors: SELECTORS });
    } finally {
      await page.close();
    }
  };

  const linesOf = async (design: string, app: string) =>
    regionDeltasOf({ design: await regionsOf(design), app: await regionsOf(app) }).map(regionDeltaLineOf);

  it('names the region and the delta of a box that ends 20 px above the window bottom', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await linesOf(SHORT_BOX, FULL)).toEqual([
      'REGION components/canvas-viewport box: height -20 px in the design (design 0,0 400x280, app 0,0 400x300)',
      'REGION components/canvas-viewport clip: height -20 px in the design (design 0,0 400x280, app 0,0 400x300)',
    ]);
  });

  it('names the clip of a full box a wrapper cuts 20 px short', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await linesOf(SHORT_CLIP, FULL)).toEqual([
      'REGION components/canvas-viewport clip: height -20 px in the design (design 0,0 400x280, app 0,0 400x300)',
    ]);
  });

  it('finds no delta once the box is restored', async (context) => {
    if (!browser) return context.skip('no browser');

    expect(await linesOf(FULL, FULL)).toEqual([]);
  });
});

describe('designRegionsOf', () => {
  it('names a region by the part key of the one mark that draws it, its clip defaulting to its box', () => {
    const marks = [
      { parts: ['components/zoom-chip'], x: 1, y: 2, width: 3, height: 4 },
      {
        parts: ['components/canvas-viewport'],
        x: 0,
        y: 0,
        width: 9,
        height: 9,
        clip: { x: 0, y: 0, width: 9, height: 7 },
      },
      { parts: ['components/button'], x: 0, y: 0, width: 1, height: 1 },
      { parts: ['components/button'], x: 5, y: 0, width: 1, height: 1 },
    ];

    expect(designRegionsOf(marks, ['components/zoom-chip', 'components/canvas-viewport', 'components/button'])).toEqual(
      [
        {
          name: 'components/zoom-chip',
          box: { x: 1, y: 2, width: 3, height: 4 },
          clip: { x: 1, y: 2, width: 3, height: 4 },
        },
        {
          name: 'components/canvas-viewport',
          box: { x: 0, y: 0, width: 9, height: 9 },
          clip: { x: 0, y: 0, width: 9, height: 7 },
        },
      ],
    );
  });
});
