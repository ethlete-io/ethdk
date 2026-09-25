import { expect, type Page, test } from '@playwright/test';
import { expectNoCspViolations, watchCsp } from './support/csp';

const editorOf = (page: Page) => page.getByTestId('editor').locator('[contenteditable="true"]').first();

test.describe('SDK under a strict nonce-based CSP', () => {
  test('dialog overlay', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/overlay');
    await page.getByTestId('open').click();
    await expect(page.getByTestId('dialog-body')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('menu and tooltip', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/menu-tooltip');
    await page.getByTestId('menu-trigger').click();
    await expect(page.getByRole('menuitem', { name: 'New file' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('tooltip-trigger').hover();
    await expect(page.getByText('Tooltip text')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('button with style-manager mounted styles', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/button');
    await expect(page.getByTestId('button')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('table with virtual scroll', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/table');
    await expect(page.getByText('Row 0', { exact: true })).toBeVisible();
    await page.getByTestId('table').evaluate((table) => table.scrollTo({ top: 4000 }));
    await expect(page.getByText(/^Row \d{2,3}$/).first()).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('surface and colour theming', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/theming');
    await expect(page.getByTestId('surface')).toBeVisible();
    await page.getByRole('button', { name: 'Error themed' }).hover();
    await expectNoCspViolations(csp);
  });

  test('legacy runtime colour themes', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/legacy-theming');
    await expect(page.getByTestId('legacy')).toBeVisible();
    await expect(page.locator('head style[id*="app-accent"]').first()).toBeAttached();
    await expectNoCspViolations(csp);
  });

  test('markdown with an aligned table', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/markdown');
    await expect(page.getByTestId('markdown').getByRole('table')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('rich-text editor with initial content', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/rich-text');
    await expect(editorOf(page)).toContainText('Initial content');
    await expect(editorOf(page).getByRole('table')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('rich-text editor with pasted HTML', async ({ page }) => {
    // Known violation: pasteHtml in libs/components/src/lib/forms/rich-text-editor/headless/rich-text-editor.directive.ts
    // parses the clipboard with DOMParser, which inherits the page's CSP and reports every pasted style attribute (style-src-attr).
    test.fail();
    const csp = await watchCsp(page);
    await page.goto('/rich-text');
    const editable = editorOf(page);
    await expect(editable).toContainText('Initial content');
    await editable.click();
    await editable.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text/html', '<p style="color: red">Pasted <strong style="font-weight: 900">HTML</strong></p>');
      data.setData('text/plain', 'Pasted HTML');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(editable).toContainText('Pasted');
    await expectNoCspViolations(csp);
  });

  test('skeleton', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/skeleton');
    await expect(page.getByTestId('skeleton')).toBeVisible();
    await expectNoCspViolations(csp);
  });

  test('query devtools toggle and lazy panel', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/devtools');
    await expect(page.getByTestId('devtools-route')).toBeVisible();
    await page.getByRole('button', { name: 'Show the devtools switches' }).click();
    await expect(page.locator('#et-query-devtools-pill').getByText('App API')).toBeVisible();
    await page.locator('et-query-devtools-toggle').getByRole('button').click();
    await expect(page.locator('et-query-devtools').getByRole('tab').first()).toBeVisible();
    await expectNoCspViolations(csp);
  });
});

test.describe('self-test', () => {
  test('a nonce-less style element is reported', async ({ page }) => {
    const csp = await watchCsp(page);
    await page.goto('/negative-control');
    await expect(page.getByTestId('rendered')).toBeVisible();
    const { violations } = await csp.collect();
    expect(violations).toContainEqual(expect.objectContaining({ directive: 'style-src-elem', blockedURI: 'inline' }));
  });
});
