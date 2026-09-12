import { Page } from '@playwright/test';
import { expect, openWaitingForAName, readBackend, test } from './support';

/** The default world's second stretch names no issue, which is the context this form is opened for. */
const openTheForm = async (page: Page) => {
  await openWaitingForAName(page);
  await page.getByRole('button', { name: 'Create a ticket' }).click();
};

/** The level picker inside the new-parent form, addressed by its own field's label. */
const levelSelect = (page: Page) => page.locator('et-form-field').filter({ hasText: 'Level' }).locator('et-select');

const created = async (page: Page) => (await readBackend(page)).jira.created;

test.describe('filing the parent a ticket rolls up to', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
    await openTheForm(page);
  });

  test('offers the levels the instance holds, rather than a type name typed from memory', async ({ page }) => {
    await page.getByRole('button', { name: 'New parent' }).click();
    await levelSelect(page).click();

    await expect(page.getByRole('option', { name: 'Story', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Epic', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Task', exact: true })).toBeHidden();
  });

  test('files it at the level that was picked', async ({ page }) => {
    await page.getByRole('button', { name: 'New parent' }).click();
    await levelSelect(page).click();
    await page.getByRole('option', { name: 'Epic', exact: true }).click();
    await page.getByRole('button', { name: /File the Epic/ }).click();

    await expect.poll(async () => (await created(page)).map((issue) => issue.issueType)).toEqual(['Epic']);
  });

  test('files it with no parent of its own, in the project the ticket names', async ({ page }) => {
    await page.getByRole('button', { name: 'New parent' }).click();
    await page.getByRole('button', { name: /File the Story/ }).click();

    await expect.poll(async () => (await created(page)).map((issue) => issue.parentKey)).toEqual([undefined]);
    expect((await created(page))[0]?.key).toMatch(/^ABC-/);
  });

  test('takes the filed parent as the parent of the ticket, and closes the form', async ({ page }) => {
    await page.getByRole('button', { name: 'New parent' }).click();
    await page.getByRole('button', { name: /File the Story/ }).click();

    await expect.poll(async () => (await created(page)).length).toBe(1);

    const key = (await created(page))[0]?.key ?? '';

    await expect(page.getByRole('button', { name: 'New parent' })).toBeVisible();
    await expect(parentField(page)).toContainText(key);
  });

  test('closes the form again on a cancel, filing nothing', async ({ page }) => {
    await page.getByRole('button', { name: 'New parent' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(levelSelect(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'New parent' })).toBeVisible();
    expect(await created(page)).toEqual([]);
  });
});

const parentField = (page: Page) => page.locator('et-form-field').filter({ hasText: 'Parent' }).first();
