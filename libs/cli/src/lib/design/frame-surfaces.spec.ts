import { transformSync } from 'esbuild';
import { readFileSync } from 'fs';
import { chromium, type Browser, type Page } from 'playwright';
import { resolve } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const WEB = resolve(__dirname, '../../../design/web');

const surfaceRule = (selector: string, type: string, elevation: number) =>
  `${selector} { --et-surface-type: ${type}; --et-surface-elevation: ${elevation}; }`;

const THEMES_CSS = `@layer base {
  ${surfaceRule('.et-surface--default-dark, .et-surface--dark', 'dark', 0)}
  ${surfaceRule('.et-surface--dark-elevated', 'dark', 1)}
  ${surfaceRule('.et-surface--dark-elevated-2', 'dark', 2)}
  ${surfaceRule('.et-surface--light', 'light', 0)}
  ${surfaceRule('.et-surface--light-elevated', 'light', 1)}
  ${surfaceRule(':root', 'dark', 0)}
}`;

const INTERACTIVE_CSS = '.et-surface-interactive { outline: 1px solid; }';

const SURFACES_SCRIPT = transformSync(readFileSync(resolve(WEB, 'frame-surfaces.ts'), 'utf8'), {
  loader: 'ts',
  format: 'iife',
  globalName: 'frameSurfaces',
}).code;

describe('frame surfaces', () => {
  let browser: Browser | undefined;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => undefined);
  });

  afterAll(() => browser?.close());

  const frameOf = async (browser: Browser, body: string) => {
    const page = await browser.newPage();

    await page.setContent(`<style>${THEMES_CSS}</style><div id="root">${body}</div>`);
    await page.addScriptTag({ content: SURFACES_SCRIPT });
    await page.evaluate(
      (css) =>
        (
          window as unknown as { frameSurfaces: { watchSurfaces: (root: HTMLElement, css: string) => void } }
        ).frameSurfaces.watchSurfaces(document.querySelector('#root')!, css),
      INTERACTIVE_CSS,
    );

    return page;
  };

  const classesOf = (page: Page) =>
    page.evaluate(() =>
      Object.fromEntries(
        Array.from(document.querySelectorAll('[id]')).map((element) => [element.id, element.className]),
      ),
    );

  it('resolves nested auto surfaces outer first, one elevation up, and keeps the parent past the last theme', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await frameOf(
      browser,
      '<div id="a" data-et-auto-surface><div id="b" data-et-auto-surface><div id="c" data-et-auto-surface></div></div></div><div id="plain"></div>',
    );

    expect(await classesOf(page)).toEqual({
      root: '',
      a: 'et-surface--dark-elevated',
      b: 'et-surface--dark-elevated-2',
      c: '',
      plain: '',
    });
    await page.close();
  });

  it('keeps the type of the surface it sits on and never touches the frame root', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await frameOf(browser, '<div id="a" data-et-auto-surface></div>');

    expect(await classesOf(page)).toMatchObject({ root: '', a: 'et-surface--dark-elevated' });

    await page.evaluate(() => document.querySelector('#root')!.classList.add('et-surface--light'));

    expect(await classesOf(page)).toEqual({ root: 'et-surface--light', a: 'et-surface--light-elevated' });
    await page.close();
  });

  it('resolves markup that replaces the drawing, as a state switch does', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await frameOf(browser, '<div class="et-surface--dark-elevated"></div>');

    await page.evaluate(() => {
      document.querySelector('#root')!.innerHTML =
        '<div id="raised" class="et-surface--dark-elevated"><div id="a" data-et-auto-surface></div></div>';
    });

    expect(await classesOf(page)).toMatchObject({ a: 'et-surface--dark-elevated-2' });
    await page.close();
  });

  it('marks interactive surfaces and loads their CSS once', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await frameOf(
      browser,
      '<button id="x" data-et-surface-interactive></button><button id="y" data-et-surface-interactive></button>',
    );

    await page.evaluate(() => {
      document.querySelector('#root')!.insertAdjacentHTML('beforeend', '<a id="z" data-et-surface-interactive></a>');
    });

    expect(await classesOf(page)).toMatchObject({
      x: 'et-surface-interactive',
      y: 'et-surface-interactive',
      z: 'et-surface-interactive',
    });
    expect(
      await page.evaluate(
        (css) => Array.from(document.querySelectorAll('style')).filter((style) => style.textContent === css).length,
        INTERACTIVE_CSS,
      ),
    ).toBe(1);
    await page.close();
  });

  it('loads nothing for a drawing without interactive surfaces', async (context) => {
    if (!browser) return context.skip('no browser');

    const page = await frameOf(browser, '<div></div>');

    expect(await page.evaluate(() => document.querySelectorAll('style').length)).toBe(1);
    await page.close();
  });
}, 30_000);

describe('surface interactive CSS', () => {
  it('is the CSS of etSurfaceInteractive in @ethlete/core', () => {
    expect(readFileSync(resolve(WEB, 'surface-interactive.css'), 'utf8')).toBe(
      readFileSync(
        resolve(__dirname, '../../../../core/src/lib/theming/surface-interactive-styles.component.css'),
        'utf8',
      ),
    );
  });
});
