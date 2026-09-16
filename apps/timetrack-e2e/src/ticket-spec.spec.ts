import { Page } from '@playwright/test';
import { E2E_ISSUE_KEY } from '@ethlete/timetrack/testing';
import { expect, openWaitingForAName, seedWorld, test } from './support';

/** The keyless stretch of the default day, whose one commit is `d4e5f6a`. */
const KEYLESS_COMMIT = 'd4e5f6a';

const TRACK = 'context/tracks/export';

const openTheForm = async (page: Page) => {
  await openWaitingForAName(page);
  await page.getByRole('button', { name: 'Create a ticket' }).click();
};

const parentField = (page: Page) => page.locator('et-form-field').filter({ hasText: 'Parent' });

const seedTheSpec = (page: Page, metadata: Record<string, unknown>, index?: string) =>
  seedWorld(page, {
    git: { commitPaths: { [KEYLESS_COMMIT]: [`${TRACK}/index.md`, 'src/pdf-export.ts'] } },
    spec: { directory: TRACK, metadata: JSON.stringify(metadata), ...(index ? { index } : {}) },
  });

test.describe('the spec a ticket is written under', () => {
  // The seeded key is a Task, which the parent read never offers: a field holding it can only have
  // been answered by the spec.
  test('answers the parent with the epic the spec names', async ({ page }) => {
    await seedTheSpec(page, { title: 'Rechnungsexport', type: 'feature', jira_epic: E2E_ISSUE_KEY });
    await page.goto('/day');
    await openTheForm(page);

    await expect(parentField(page)).toContainText(E2E_ISSUE_KEY);
    await expect(page.getByText(`The spec names ${E2E_ISSUE_KEY}.`)).toBeVisible();
  });

  test('leaves the parent to the ranking where the spec names no epic', async ({ page }) => {
    await seedTheSpec(page, { title: 'Rechnungsexport', type: 'feature' });
    await page.goto('/day');
    await openTheForm(page);

    await expect(page.getByText('The spec names')).toBeHidden();
  });

  test('sends the spec with the writing call, and says so', async ({ page }) => {
    await seedTheSpec(page, { title: 'Rechnungsexport', type: 'feature' }, '## Kurzfassung\n\nDen Export ablösen.\n');
    await page.goto('/day');
    await openTheForm(page);

    const sent = page.getByText(/What gets sent .* and the spec it sits under/);

    await expect(sent).toBeVisible();
    await sent.click();

    const payload = page.locator('details', { has: sent }).locator('pre');

    await expect(payload).toContainText('Rechnungsexport');
    await expect(payload).toContainText('Den Export ablösen.');
  });

  test('sends no spec where the commits touched no directory holding one', async ({ page }) => {
    await seedWorld(page);
    await page.goto('/day');
    await openTheForm(page);

    await expect(page.getByText(/What gets sent .* and the spec it sits under/)).toBeHidden();
  });
});
