import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, readStoredSettings, seedWorld, test } from './support';

test.describe('the settings selects', () => {
  test('picks the suggestion language from a list and still shows an unlisted stored one', async ({ page }) => {
    const settings = defaultSettings();

    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...settings, reasoning: { ...settings.reasoning, language: 'Deutsch' } },
    });
    await page.goto('/#/settings');
    await page.getByRole('tab', { name: 'Suggestions' }).click();

    const select = page.locator('[data-reasoning-language]');

    await expect(select).toContainText('Deutsch');
    await select.click();
    await page.getByRole('option', { name: 'French' }).click();

    await expect.poll(async () => (await readStoredSettings(page))?.reasoning.language).toBe('French');
  });

  test('picks the currency from a list', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/#/settings');

    await page.locator('[data-price-currency]').click();
    await page.getByRole('option', { name: /^EUR/ }).click();

    await expect.poll(async () => (await readStoredSettings(page))?.priceTable.currency).toBe('EUR');
  });

  test('fills the model and its four prices from a preset', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: defaultSettings() });
    await page.goto('/#/settings');

    await page.locator('[data-price-preset] [role=combobox]').click();
    await page.getByRole('option', { name: 'claude-opus-5-5' }).click();
    await page.locator('[data-price-add]').click();

    await expect(page.locator('[data-model-price="claude-opus-5-5"]')).toContainText(
      'in 4 · out 20 · cache write 5 · cache read 0.2',
    );
  });
});
