import { expect, Locator, Page, test } from '@playwright/test';
import { differs, NO_TRANSITIONS, Paint, readPaint, restPointer } from './support/paint';

const SCHEMES = ['dark', 'light'] as const;
const LEVELS = ['root', 'surface', 'card', 'overlay'] as const;

type Scheme = (typeof SCHEMES)[number];
type Level = (typeof LEVELS)[number];

const TARGETS: { name: string; find: (level: Locator) => Locator }[] = [
  { name: 'accordion header', find: (level) => level.locator(':scope > et-accordion-group .et-accordion-trigger') },
  {
    name: 'table row',
    find: (level) => level.locator(':scope > et-table .et-table-row--interactive .et-table-cell').first(),
  },
  { name: 'inactive tab', find: (level) => level.locator(':scope > et-tab-group [role="tab"][aria-selected="false"]') },
  { name: 'filled button', find: (level) => level.locator(':scope > .app-theming-level-buttons > button').nth(0) },
  { name: 'outline button', find: (level) => level.locator(':scope > .app-theming-level-buttons > button').nth(1) },
  { name: 'transparent button', find: (level) => level.locator(':scope > .app-theming-level-buttons > button').nth(2) },
  { name: 'tint row', find: (level) => level.locator(':scope > .app-theming-level-rows [data-row="tint"]') },
  {
    name: 'next background row',
    find: (level) => level.locator(':scope > .app-theming-level-rows [data-row="next-background"]'),
  },
  { name: 'menu trigger', find: (level) => level.locator(':scope > .app-theming-level-buttons [etmenutrigger]') },
];

const openDemo = async (page: Page, scheme: Scheme) => {
  await page.goto('/?id=theming/theming-levels&theme=dark');
  await page.addStyleTag({ content: NO_TRANSITIONS });
  await expect(page.locator('[data-level="root"]')).toBeVisible();

  if (scheme === 'light') await page.locator('[data-switch="scheme"]').click();

  await expect(page.locator('[data-switch="scheme"]')).toContainText(scheme);
};

const openLevel = async (page: Page, level: Level) => {
  if (level === 'overlay') {
    await page.getByRole('button', { name: 'Open overlay' }).click();
  }

  const element = page.locator(`[data-level="${level}"]`);

  await expect(element).toBeVisible();

  return element;
};

const measure = async (page: Page, target: Locator) => {
  await restPointer(page);
  const rest = await readPaint(target);

  await target.hover();
  const hover = await readPaint(target);

  await page.mouse.down();
  const pressed = await readPaint(target);

  await page.mouse.up();
  await restPointer(page);

  return { rest, hover, pressed };
};

const expectVisibleStates = (name: string, states: { rest: Paint; hover: Paint; pressed: Paint }) => {
  expect.soft(differs(states.hover, states.rest), `${name}: hover ${JSON.stringify(states)}`).toBe(true);
  expect.soft(differs(states.pressed, states.rest), `${name}: pressed ${JSON.stringify(states)}`).toBe(true);
};

for (const scheme of SCHEMES) {
  for (const level of LEVELS) {
    test(`${scheme} ${level}: hover and pressed differ from rest`, async ({ page }) => {
      await openDemo(page, scheme);
      const element = await openLevel(page, level);

      for (const target of TARGETS) {
        expectVisibleStates(target.name, await measure(page, target.find(element)));
      }

      await expect(page.locator('et-menu')).toBeVisible();

      expectVisibleStates('menu item', await measure(page, page.locator('et-menu [et-menu-item]').first()));
    });
  }

  test(`${scheme} B-65: accordion hover with "hover = next level" stays visible on the surface level`, async ({
    page,
  }) => {
    await openDemo(page, scheme);
    await page.locator('[data-switch="hover-next-level"]').click();
    await expect(page.locator('[data-switch="hover-next-level"]')).toHaveAttribute('aria-pressed', 'true');

    const states = await measure(
      page,
      page.locator('[data-level="surface"] > et-accordion-group .et-accordion-trigger'),
    );

    expect(differs(states.hover, states.rest), JSON.stringify(states)).toBe(true);
  });
}
