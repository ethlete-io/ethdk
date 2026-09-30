import { AgentApiDayRows, shiftDayKey } from '@ethlete/timetrack';
import { E2E_DAY_KEY, askAgent, expect, test } from './support';

test.describe('day.rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('answers other days without moving the screen off its own', async ({ page }) => {
    const heading = page.locator('ethlete-day-review header h2');

    await expect(heading).toBeVisible();

    const shown = await heading.textContent();
    const before = shiftDayKey(E2E_DAY_KEY, -1);
    const after = shiftDayKey(E2E_DAY_KEY, 1);

    expect(await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: before })).toMatchObject({
      ok: true,
      value: { day: before },
    });
    await expect(heading).toHaveText(shown ?? '');

    const answers = await Promise.all([
      askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: before }),
      askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: after }),
    ]);

    expect(answers).toMatchObject([
      { ok: true, value: { day: before } },
      { ok: true, value: { day: after } },
    ]);
    await expect(heading).toHaveText(shown ?? '');
  });

  test('answers the rows the screen draws for its saved day', async ({ page }) => {
    await expect(page.locator('[data-kind="row"]').first()).toBeVisible();

    const answer = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });
    const drawn = await page.locator('[data-kind="row"]').count();

    expect(answer.ok && answer.value.rows.length).toBe(drawn);
  });
});
