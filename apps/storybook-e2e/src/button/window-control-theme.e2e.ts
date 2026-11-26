import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../../..');

const STUDIO_CSS = [
  'apps/ethlete-studio/src/styles/themes.css',
  'apps/ethlete-studio/src/styles/surface-themes.css',
  'apps/ethlete-studio/src/styles/farn-surface-themes.css',
  'libs/components/src/lib/button/window-control-button.component.css',
]
  .map((path) => readFileSync(join(ROOT, path), 'utf8'))
  .join('\n');

const SURFACES = [
  { scheme: 'dark', surface: 'et-surface--dark', interaction: [164, 164, 164] },
  { scheme: 'light', surface: 'et-surface--farn', interaction: [86, 100, 88] },
] as const;

test.describe('window-control button / rest fill in the Studio surface colour', () => {
  for (const { scheme, surface, interaction } of SURFACES) {
    test(`a square button rests transparent and a round one at a 10% tint on a ${scheme} surface`, async ({ page }) => {
      await page.setContent(`<style>${STUDIO_CSS}</style>
        <div class="${surface}" style="color-scheme: ${scheme}">
          <button id="square" class="et-window-control-button et-color--surface"></button>
          <button id="round" class="et-window-control-button et-color--surface" data-shape="round"></button>
        </div>`);

      const restFill = (selector: string) =>
        page.locator(selector).evaluate((el) => {
          const context = document.createElement('canvas').getContext('2d');
          if (!context) throw new Error('no 2d context');
          context.fillStyle = getComputedStyle(el).backgroundColor;
          context.fillRect(0, 0, 1, 1);

          const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;

          return { rgb: [r, g, b] as const, alpha: a };
        });

      const square = await restFill('#square');
      const round = await restFill('#round');
      const [ir, ig, ib] = interaction;
      const [r, g, b] = round.rgb;

      expect(square.alpha).toBe(0);
      expect(Math.abs(round.alpha - 0.1 * 255)).toBeLessThanOrEqual(1);
      expect(Math.max(Math.abs(r - ir), Math.abs(g - ig), Math.abs(b - ib))).toBeLessThanOrEqual(6);
    });
  }
});
