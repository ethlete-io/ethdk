import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  measureProblemsOf,
  PLATFORM_MEASURE_RULE,
  platformMeasureIssuesOf,
  platformMeasuresOf,
  type PlatformMeasure,
} from './platform-measures';

const caption: PlatformMeasure = {
  platform: 'Windows 11',
  states: ['windows'],
  target: '.tile',
  width: 46,
  height: 32,
  inset: { edge: '.bar', top: 0, right: 0 },
  ink: { width: 10, height: 10 },
};

const barOf = (
  viewBox: string,
  tileWidth = 46,
) => `<style>body { margin: 0 } .bar { display: flex; justify-content: flex-end; height: 32px; background: #202020 }
  .tile { display: grid; place-items: center; width: ${tileWidth}px; height: 32px; color: #fff }</style>
  <div class="bar"><span class="tile"><svg width="10" height="10" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1"><rect x="0.5" y="0.5" width="9" height="9" rx="1"/></svg></span></div>`;

describe('platformMeasuresOf', () => {
  it('keeps the measures that name the state', () => {
    expect(platformMeasuresOf({ platformMeasures: [caption] }, 'windows')).toEqual([
      { ...caption, tolerance: undefined },
    ]);
    expect(platformMeasuresOf({ platformMeasures: [caption] }, 'linux')).toEqual([]);
    expect(platformMeasuresOf({}, 'windows')).toEqual([]);
  });
});

describe('measureProblemsOf', () => {
  it('names each declared value the element misses, with declared and measured', () => {
    expect(
      measureProblemsOf(caption, {
        width: 46,
        height: 32,
        inset: { top: 0, right: 0, bottom: 0, left: 1394 },
        ink: { width: 10, height: 10 },
      }),
    ).toEqual([]);
    expect(
      measureProblemsOf(caption, {
        width: 40,
        height: 32,
        inset: { top: 0, right: 2, bottom: 0, left: 0 },
        ink: { width: 6, height: 6 },
      }),
    ).toEqual([
      'width 40px, Windows 11 declares 46px',
      'right inset 2px, Windows 11 declares 0px',
      'ink width 6px, Windows 11 declares 10px',
      'ink height 6px, Windows 11 declares 10px',
    ]);
  });
});

describe('platformMeasureIssuesOf', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('passes a 46 px tile flush right whose glyph draws 10 px of ink', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(barOf('0 0 10 10'));
    expect(await platformMeasureIssuesOf(page, [caption])).toEqual([]);
    await page.close();
  }, 10_000);

  it('fails a glyph whose 10 px box draws less ink, the box measured as ink', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(barOf('-3 -3 16 16'));

    const [issue, ...rest] = await platformMeasureIssuesOf(page, [caption]);

    expect(rest).toEqual([]);
    expect(issue?.rule).toBe(PLATFORM_MEASURE_RULE);
    expect(issue?.detail).toMatch(/^ink width [5-7]px, Windows 11 declares 10px; ink height [5-7]px/);
    await page.close();
  }, 10_000);

  it('fails a tile narrower than the platform declares and a target that matches nothing', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await browser.newPage();

    await page.setContent(barOf('0 0 10 10', 40));
    expect(
      (await platformMeasureIssuesOf(page, [caption, { ...caption, target: '.gone' }])).map(({ detail }) => detail),
    ).toEqual(['width 40px, Windows 11 declares 46px', 'matches no element, so no Windows 11 measure was taken']);
    await page.close();
  }, 10_000);
}, 30_000);
