import { expect, test } from '@playwright/test';
import { openStory } from '../support';

const PANEL_STORY_ID = 'components-sports-bracket-adaptive--one-round-panel';

test.describe('bracket relayout / the transition', () => {
  test('cells move with a transform and connectors carry the path in CSS as well', async ({ page }) => {
    const root = await openStory(page, PANEL_STORY_ID);

    const cell = root.locator('.et-bracket-element--match').first();
    await expect(cell).toHaveCSS('transition-property', /transform/);

    const path = root.locator('.et-bracket-svg path').first();
    await expect(path).toHaveAttribute('d', /^M/);
    await expect(path).toHaveCSS('transition-property', /\bd\b/);

    const cssPath = await path.evaluate((el) => getComputedStyle(el).getPropertyValue('d'));
    expect(cssPath).toContain('path(');
  });

  test('--et-bracket-move-duration paces it', async ({ page }) => {
    const root = await openStory(page, PANEL_STORY_ID);

    await expect(root.locator('.et-bracket-element--match').first()).toHaveCSS('transition-duration', /^0\.2s/);
    await expect(root.locator('.et-bracket-svg path').first()).toHaveCSS('transition-duration', /^0\.2s/);
  });

  test('a step moves the same nodes rather than replacing them', async ({ page }) => {
    const root = await openStory(page, PANEL_STORY_ID);
    const marked = '.et-bracket-element--match[data-e2e-marked], .et-bracket-svg path[data-e2e-marked]';

    const before = await root.evaluate((host) => {
      const nodes = host.querySelectorAll('.et-bracket-element--match, .et-bracket-svg path');

      return Array.from(nodes).map((node, index) => {
        node.setAttribute('data-e2e-marked', String(index));

        return node instanceof SVGElement
          ? getComputedStyle(node).getPropertyValue('d')
          : getComputedStyle(node).transform;
      });
    });

    const count = before.length;
    expect(count).toBeGreaterThan(0);

    await root.getByTestId('next-round').click();

    const read = () =>
      root.evaluate((host) =>
        Array.from(host.querySelectorAll('.et-bracket-element--match, .et-bracket-svg path')).map((node) =>
          node instanceof SVGElement ? getComputedStyle(node).getPropertyValue('d') : getComputedStyle(node).transform,
        ),
      );

    await expect.poll(async () => (await read()).join('|')).not.toBe(before.join('|'));

    // A marker only survives if the node was transitioned - a re-created node cannot animate, and would
    // have lost the attribute this test wrote onto it.
    await expect(root.locator(marked)).toHaveCount(count);
  });

  test('focusInset keeps the focused round that far from the panel edge', async ({ page }) => {
    const root = await openStory(page, PANEL_STORY_ID, { args: { focusInset: 40 } });

    const panelLeft = await root.getByTestId('panel').evaluate((el) => el.getBoundingClientRect().left);
    const columnLeft = await root
      .locator('.et-bracket-element--match')
      .first()
      .evaluate((el) => el.getBoundingClientRect().left);

    expect(columnLeft - panelLeft).toBeGreaterThanOrEqual(40);
  });
});

test.describe('bracket relayout / reduced motion', () => {
  test('drops the transition entirely', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, PANEL_STORY_ID);

    await expect(root.locator('.et-bracket-element--match').first()).toHaveCSS('transition-duration', '0s');
    await expect(root.locator('.et-bracket-svg path').first()).toHaveCSS('transition-duration', '0s');
  });
});
