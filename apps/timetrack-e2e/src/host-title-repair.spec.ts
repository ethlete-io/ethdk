import { CollectedEvent } from '@ethlete/timetrack';
import { e2eAt } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, seedWorld, test } from './support';

const focus = (title: string): CollectedEvent => ({
  at: e2eAt(9, 30),
  source: 'window',
  kind: 'window-focus',
  appId: 'com.google.Chrome',
  title,
});

/**
 * The redaction of a URL inside a window title runs on the way into the store, so it protects nothing
 * that was collected before it existed. These runs are what say the repair pass reaches those rows.
 */
test.describe('redacting the titles already stored', () => {
  test('redacts a title that was collected with its query string', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      events: [focus('accounts.google.com/signin/oauth?rapt=AEjHL4Na - Google Chrome')],
    });
    await page.goto('/host');

    await page.getByRole('button', { name: 'Redact stored titles' }).click();

    await expect(page.getByText('Read 1 stored title and redacted 1.')).toBeVisible();
  });

  test('says it changed nothing on a store whose titles are already clean', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [focus('timer.rs - Visual Studio Code')] });
    await page.goto('/host');

    await page.getByRole('button', { name: 'Redact stored titles' }).click();

    await expect(page.getByText('None held a query string.')).toBeVisible();
  });

  test('has nothing left to change on a second run', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, events: [focus('gitlab.com/search?q=secret')] });
    await page.goto('/host');
    const button = page.getByRole('button', { name: 'Redact stored titles' });

    await button.click();
    await expect(page.getByText('and redacted 1.')).toBeVisible();

    await button.click();

    await expect(page.getByText('None held a query string.')).toBeVisible();
  });
});
