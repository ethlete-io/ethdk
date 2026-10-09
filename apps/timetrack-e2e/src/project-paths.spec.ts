import { E2E_REPO, defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, readStoredSettings, seedWorld, test } from './support';

const SIDE = '/Users/e2e/dev/private/weekend-game';

const ABC = { key: 'ABC', name: '[10124] FIFAGG Community Platform' };
const XYZ = { key: 'XYZ', name: '[10310] Ethlete Design System' };

test.beforeEach(async ({ page }) => {
  await seedWorld(page, {
    now: E2E_NOW,
    git: { repoPath: E2E_REPO, extraRepos: [SIDE] },
    jira: { projects: [ABC, XYZ] },
    settings: {
      ...defaultSettings(),
      favoriteProjects: [ABC, XYZ],
      projectLinks: [
        { id: 'l1', path: E2E_REPO, target: { kind: 'project', projectKey: ABC.key }, createdAt: new Date(0) },
      ],
    },
  });
  await page.goto('/day');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Projects' }).click();
});

test.describe('the project picker on a path row', () => {
  test('reads the whole project name, though the row has no width for it', async ({ page }) => {
    const row = page.locator('ethlete-project-paths li').first();

    await row.locator('et-select').click();

    const option = page.getByRole('option', { name: /FIFAGG Community Platform/ });

    await expect(option).toBeVisible();
    /**
     * The panel is content-sized rather than pinned to the field, so the name is not cut off. A
     * mirrored panel is as narrow as the column, which leaves one word of the name readable.
     */
    await expect
      .poll(async () => {
        const panel = (await option.boundingBox())?.width ?? 0;
        const field = (await row.locator('et-select').boundingBox())?.width ?? 0;

        return panel > field;
      })
      .toBe(true);
  });
});

test.describe('a repository alias', () => {
  test('is set for a checkout as a lower-case key, and taken off again', async ({ page }) => {
    const aliases = page.locator('ethlete-repo-aliases');

    await aliases.getByRole('textbox', { name: 'Checkout' }).fill(E2E_REPO);
    await aliases.getByRole('textbox', { name: 'Alias' }).fill('FUT-Frontend');
    await aliases.getByRole('button', { name: 'Set alias' }).click();

    await expect(aliases.locator(`[data-alias-path="${E2E_REPO}"] [data-alias-key]`)).toHaveText('fut-frontend');
    await expect
      .poll(async () => (await readStoredSettings(page))?.repoAliases)
      .toEqual({ [E2E_REPO]: 'fut-frontend' });

    await aliases.getByRole('button', { name: `Remove the alias of ${E2E_REPO}` }).click();

    await expect(aliases.locator('[data-alias-path]')).toHaveCount(0);
    await expect.poll(async () => (await readStoredSettings(page))?.repoAliases).toEqual({});
  });
});
