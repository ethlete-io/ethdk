import { Page, expect, test } from '@playwright/test';
import { TouchPoint, boxOf, openStory, touchDrag } from '../support';

const STORY_ID = 'core-resize-handles--default';

const stylesheetsLoaded = () =>
  Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).every((link) => !!link.sheet);

async function openPopOut(page: Page): Promise<Page> {
  const root = await openStory(page, STORY_ID);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    root.getByRole('button', { name: 'Pop out' }).click(),
  ]);

  await expect(root.getByTestId('popout-state')).toHaveText('popped-out');
  await expect(popup.getByTestId('box')).toBeVisible();
  await expect.poll(() => popup.evaluate(stylesheetsLoaded)).toBe(true);

  return popup;
}

async function cornerOf(target: Page): Promise<TouchPoint> {
  const handle = await boxOf(target.locator('.et-resize-handle--se'));

  return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
}

const userSelectOf = (target: Page) => target.evaluate(() => document.documentElement.style.userSelect);

async function touchStartMoveCancel(target: Page, from: TouchPoint, to: TouchPoint): Promise<void> {
  const client = await target.context().newCDPSession(target);

  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
  await expect(target.getByTestId('size')).not.toHaveText('200x120');
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
}

test.describe('core resize handles / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: mouse drag');

  test('a drag on the corner handle resizes the box in the main document', async ({ page }) => {
    const root = await openStory(page, STORY_ID);
    const corner = await cornerOf(page);

    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + 60, corner.y + 40, { steps: 5 });
    await page.mouse.up();

    await expect(root.getByTestId('size')).toHaveText('260x160');
  });

  test('a drag on the corner handle in a pop-out window resizes the box by the pointer delta', async ({ page }) => {
    const popup = await openPopOut(page);
    const handles = popup.locator('.et-resize-handles');
    const corner = await cornerOf(popup);

    await popup.mouse.move(corner.x, corner.y);
    await popup.mouse.down();
    await popup.mouse.move(corner.x + 60, corner.y + 40, { steps: 5 });

    await expect(handles).toHaveAttribute('data-active-edge', 'se');
    await expect(popup.getByTestId('size')).toHaveText('260x160');

    await popup.mouse.up();

    await expect(handles).not.toHaveAttribute('data-active-edge');
    await expect(popup.getByTestId('box')).toHaveCSS('width', '260px');
  });

  test('a drag in the pop-out suppresses text selection in the pop-out only while it runs', async ({ page }) => {
    const popup = await openPopOut(page);
    const corner = await cornerOf(popup);

    await popup.mouse.move(corner.x, corner.y);
    await popup.mouse.down();
    await popup.mouse.move(corner.x + 20, corner.y + 20, { steps: 3 });

    expect(await userSelectOf(popup)).toBe('none');
    expect(await userSelectOf(page)).toBe('');

    await popup.mouse.up();

    await expect.poll(() => userSelectOf(popup)).toBe('');
  });
});

test.describe('core resize handles / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a touch drag on the corner handle in a pop-out window resizes the box', async ({ page }) => {
    const popup = await openPopOut(page);
    const corner = await cornerOf(popup);

    await touchDrag(popup, corner, { x: corner.x + 60, y: corner.y + 40 });

    await expect(popup.getByTestId('size')).toHaveText('260x160');
  });

  test('a cancelled touch in a pop-out window reverts the box to its start size', async ({ page }) => {
    const popup = await openPopOut(page);
    const corner = await cornerOf(popup);

    await touchStartMoveCancel(popup, corner, { x: corner.x + 60, y: corner.y + 40 });

    await expect(popup.getByTestId('size')).toHaveText('200x120');
    await expect.poll(() => userSelectOf(popup)).toBe('');
  });
});
