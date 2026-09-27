import { Locator, Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

const STORY_ID = 'components-forms-submission--default';
const SHORT_VIEWPORT_HEIGHT = 360;
const SAMPLED_FRAMES = 90;

type SampleWindow = Window & { __scrollSamples?: number[] };

async function openShortForm(page: Page): Promise<Locator> {
  const width = page.viewportSize()?.width ?? 800;

  await page.setViewportSize({ width, height: SHORT_VIEWPORT_HEIGHT });

  const root = await openStory(page, STORY_ID);

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

  return root;
}

/** Every window.scrollY seen on the next animation frames, starting before `action` runs. */
async function scrollPositionsDuring(page: Page, action: () => Promise<void>): Promise<number[]> {
  await page.evaluate((count) => {
    const samples: number[] = [];
    const record = () => {
      samples.push(Math.round(window.scrollY));

      if (samples.length < count) requestAnimationFrame(record);
    };

    (window as SampleWindow).__scrollSamples = samples;
    requestAnimationFrame(record);
  }, SAMPLED_FRAMES);

  await action();

  await expect
    .poll(() => page.evaluate(() => (window as SampleWindow).__scrollSamples?.length ?? 0))
    .toBeGreaterThanOrEqual(SAMPLED_FRAMES);

  return page.evaluate(() => (window as SampleWindow).__scrollSamples ?? []);
}

function distinctPositions(samples: number[]): number {
  return new Set(samples).size;
}

/** How far the field's form-field shell sits from the viewport's vertical centre, in CSS pixels. */
function offViewportCentre(field: Locator): Promise<number> {
  return field.evaluate((el) => {
    const shell = el.closest('et-form-field') ?? el;
    const rect = shell.getBoundingClientRect();

    return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
  });
}

test.describe('form-submission / invalid submit', () => {
  test('an invalid submit glides back to the first invalid field and focuses its control', async ({ page }) => {
    const root = await openShortForm(page);
    const email = root.getByRole('textbox', { name: 'Email' });
    const submit = root.getByRole('button', { name: 'Create account' });

    await expect(email).not.toBeInViewport();

    const samples = await scrollPositionsDuring(page, () => submit.click());

    expect(distinctPositions(samples)).toBeGreaterThan(3);
    await expect(email).toBeFocused();
    await expect(email).toBeInViewport();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  test('under reduced motion the jump to the first invalid field is instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openShortForm(page);
    const email = root.getByRole('textbox', { name: 'Email' });
    const submit = root.getByRole('button', { name: 'Create account' });

    const samples = await scrollPositionsDuring(page, () => submit.click());

    expect(distinctPositions(samples)).toBeLessThanOrEqual(2);
    await expect(email).toBeFocused();
    await expect(email).toBeInViewport();
  });

  test('a field further down lands in the middle of the viewport, not at an edge', async ({ page }) => {
    const root = await openShortForm(page);
    const email = root.getByRole('textbox', { name: 'Email' });
    const password = root.getByLabel('Password');
    const displayName = root.getByRole('textbox', { name: 'Display name' });
    const submit = root.getByRole('button', { name: 'Create account' });

    await email.fill('team-a@example.com');
    await password.fill('long-enough');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

    await submit.click();

    await expect(displayName).toBeFocused();
    await expect.poll(() => offViewportCentre(displayName)).toBeLessThan(SHORT_VIEWPORT_HEIGHT / 6);
  });

  test('the first invalid field is picked in document order, skipping the valid ones', async ({ page }) => {
    const root = await openShortForm(page);
    const email = root.getByRole('textbox', { name: 'Email' });
    const password = root.getByLabel('Password');
    const submit = root.getByRole('button', { name: 'Create account' });

    await email.fill('team-a@example.com');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

    await submit.click();

    await expect(password).toBeFocused();
    await expect(password).toBeInViewport();
    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  });
});
