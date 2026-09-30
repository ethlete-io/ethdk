import { Page } from '@playwright/test';
import { AgentApiDayRows, shiftDayKey } from '@ethlete/timetrack';
import { E2E_DAY_KEY, askAgent, expect, openApprovals, queuedId, test } from './support';

const readsOf = (day: string) => [
  { op: 'day.rows', day },
  { op: 'day.events', day },
  { op: 'day.inputs', day },
  { op: 'naming.offers', day },
  { op: 'tempo.sync', day },
];

const writesOf = (day: string) => [
  { op: 'day.edits', day, edits: [{ kind: 'hidden', rowId: 'no-such-row', hidden: true }], client: 'Claude Code' },
  {
    op: 'worklog.add',
    issueKey: 'ABC-1',
    description: 'Elsewhere',
    fromMs: new Date(`${day}T09:00:00.000Z`).getTime(),
    durationMs: 900_000,
    client: 'Claude Code',
  },
  { op: 'tempo.sync', day, planHash: 'confirmed', client: 'Claude Code' },
  { op: 'tempo.delete', day, worklogId: '999999', client: 'Claude Code' },
];

const screenOf = async (page: Page) => ({
  heading: await page.locator('ethlete-day-review header h2').textContent(),
  saved: await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('ethlete.timetrack.view-state') ?? '{}') as Record<string, unknown>;

    return { day: state['day'], view: state['view'] };
  }),
});

const approveAll = async (page: Page, ids: readonly string[]) => {
  const dialog = await openApprovals(page);

  for (const id of ids)
    await dialog.locator(`[data-approval="${id}"]`).getByRole('button', { name: 'Approve' }).click();

  for (const id of ids) {
    await expect
      .poll(
        async () =>
          ((await askAgent<{ status: string }>(page, { op: 'approval.status', id })) as { value?: { status: string } })
            .value?.status,
      )
      .not.toBe('queued');
  }

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
};

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

  test('leaves the day on screen and its saved view alone for every op that takes a day', async ({ page }) => {
    await expect(page.locator('ethlete-day-review header h2')).toBeVisible();

    const shown = await screenOf(page);
    const before = shiftDayKey(E2E_DAY_KEY, -1);
    const after = shiftDayKey(E2E_DAY_KEY, 1);

    for (const request of readsOf(before)) {
      expect(await askAgent(page, request), request.op).toMatchObject({ ok: expect.any(Boolean) });
      expect(await screenOf(page), request.op).toEqual(shown);
    }

    await Promise.all([...readsOf(before), ...readsOf(after)].map((request) => askAgent(page, request)));
    expect(await screenOf(page)).toEqual(shown);

    for (const request of writesOf(before)) {
      await approveAll(page, [queuedId(await askAgent(page, request))]);
      expect(await screenOf(page), request.op).toEqual(shown);
    }

    const queued = await Promise.all(
      [...writesOf(before), ...writesOf(after)].map(async (request) => queuedId(await askAgent(page, request))),
    );

    await approveAll(page, queued);
    expect(await screenOf(page)).toEqual(shown);

    const written = await Promise.all(
      [before, after].map(async (day) => {
        const answer = await askAgent<AgentApiDayRows>(page, { op: 'day.rows', day });

        return answer.ok ? answer.value.rows.filter((row) => row.description === 'Elsewhere').length : 0;
      }),
    );

    expect(written).toEqual([2, 1]);
  });
});
