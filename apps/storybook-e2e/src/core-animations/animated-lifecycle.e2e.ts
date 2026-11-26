import { Locator, Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

const STORY_ID = 'core-animations-lifecycle--default';

interface Lifecycle {
  toggle: Locator;
  element: Locator;
  content: Locator;
  state: Locator;
  history: Locator;
}

async function openLifecycle(page: Page): Promise<Lifecycle> {
  const root = await openStory(page, STORY_ID);

  return {
    toggle: root.getByRole('button', { name: 'Toggle' }),
    element: root.getByTestId('lifecycle'),
    content: root.getByTestId('content'),
    state: root.getByTestId('state'),
    history: root.getByTestId('history'),
  };
}

const runningAnimations = (element: Locator) =>
  element.evaluate((el) => el.getAnimations().filter((animation) => animation.playState === 'running').length);

const opacityOf = (element: Locator) => element.evaluate((el) => Number(getComputedStyle(el).opacity));

async function expectAnimationRunning(element: Locator): Promise<void> {
  await expect.poll(() => runningAnimations(element)).toBeGreaterThan(0);
}

async function enter(lifecycle: Lifecycle): Promise<void> {
  await lifecycle.toggle.click();
  await expect(lifecycle.state).toHaveText('entered');
}

test.describe('core animated lifecycle', () => {
  test('enter runs a transition, ends entered and shows the content', async ({ page }) => {
    const lifecycle = await openLifecycle(page);

    await lifecycle.toggle.click();

    await expect(lifecycle.state).toHaveText('entering');
    await expectAnimationRunning(lifecycle.element);
    await expect(lifecycle.state).toHaveText('entered');
    await expect(lifecycle.element).toHaveClass(/et-animation-enter-done/);
    await expect(lifecycle.content).toBeVisible();
    expect(await opacityOf(lifecycle.element)).toBe(1);
  });

  test('leave keeps the content attached while its transition runs, then removes it', async ({ page }) => {
    const lifecycle = await openLifecycle(page);
    await enter(lifecycle);

    await lifecycle.toggle.click();

    await expect(lifecycle.state).toHaveText('leaving');
    await expectAnimationRunning(lifecycle.element);
    await expect(lifecycle.content).toBeAttached();
    await expect.poll(() => opacityOf(lifecycle.element)).toBeLessThan(1);

    await expect(lifecycle.state).toHaveText('left');
    await expect(lifecycle.content).toHaveCount(0);
    await expect(lifecycle.history).toHaveText('init entering entered leaving left');
  });

  test('a re-enter during the leave transition ends entered with the content kept', async ({ page }) => {
    const lifecycle = await openLifecycle(page);
    await enter(lifecycle);

    await lifecycle.toggle.click();
    await expect(lifecycle.state).toHaveText('leaving');
    await expectAnimationRunning(lifecycle.element);

    await lifecycle.toggle.click();

    await expect(lifecycle.state).toHaveText('entered');
    await expect(lifecycle.history).toHaveText('init entering entered leaving entering entered');
    await expect(lifecycle.element).toHaveClass(/et-animation-enter-done/);
    await expect(lifecycle.element).not.toHaveClass(/et-animation-leave/);
    await expect(lifecycle.content).toBeVisible();
    await expect.poll(() => opacityOf(lifecycle.element)).toBe(1);
  });

  test('a leave during the enter transition ends left with the content removed', async ({ page }) => {
    const lifecycle = await openLifecycle(page);

    await lifecycle.toggle.click();
    await expect(lifecycle.state).toHaveText('entering');
    await expectAnimationRunning(lifecycle.element);

    await lifecycle.toggle.click();

    await expect(lifecycle.state).toHaveText('left');
    await expect(lifecycle.history).toHaveText('init entering leaving left');
    await expect(lifecycle.content).toHaveCount(0);
  });

  test('with reduced motion enter and leave settle without a transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const lifecycle = await openLifecycle(page);

    await enter(lifecycle);
    await lifecycle.toggle.click();

    await expect(lifecycle.state).toHaveText('left');
    await expect(lifecycle.content).toHaveCount(0);
    await expect(lifecycle.history).toHaveText('init entering entered leaving left');
  });
});
