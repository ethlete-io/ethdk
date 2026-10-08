import { expect, addAnEntry, test } from './support';

test.describe('the time picker in the edit surface', () => {
  test('moves in 15-minute steps', async ({ page }) => {
    await page.goto('/day');

    const surface = await addAnEntry(page);

    await surface.getByRole('button', { name: 'Open time picker' }).click();

    const handle = page.getByRole('slider', { name: 'Start time' });

    await handle.focus();

    const before = await handle.getAttribute('aria-valuetext');

    await handle.press('ArrowUp');

    const minutes = (text: string | null) => {
      const [hours = 0, mins = 0] = (text ?? '').split(':').map(Number);

      return hours * 60 + mins;
    };

    await expect.poll(async () => minutes(await handle.getAttribute('aria-valuetext')) - minutes(before)).toBe(15);
  });
});
