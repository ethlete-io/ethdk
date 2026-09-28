import { E2E_EPIC_KEY, defaultSettings } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  expect,
  openApprovals,
  queuedId,
  readBackend,
  seedWorld,
  test,
} from './support';

const CREATE = { op: 'jira.create', summary: 'Pdf export', projectKey: 'ABC', client: 'Claude Code' };

test.describe('a write an agent asks for', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/day');
  });

  test('files the jira issue only after the approve press', async ({ page }) => {
    const id = queuedId(await askAgent(page, CREATE));

    expect((await readBackend(page)).jira.created).toEqual([]);
    expect(await askAgent(page, { op: 'approval.status', id })).toEqual({
      ok: true,
      value: { status: 'queued', approvalId: id },
    });

    const dialog = await openApprovals(page);
    const item = dialog.locator(`[data-approval="${id}"]`);

    await expect(item).toContainText('Files a Jira issue in ABC: Pdf export');
    await expect(item).toContainText('Claude Code');
    await item.getByRole('button', { name: 'Approve' }).click();

    await expect(item).toBeHidden();
    expect((await readBackend(page)).jira.created.map((issue) => issue.summary)).toEqual(['Pdf export']);
    expect(await askAgent(page, { op: 'approval.status', id })).toEqual({
      ok: true,
      value: {
        status: 'approved',
        approvalId: id,
        result: { issue: { key: expect.any(String), id: expect.any(String) } },
      },
    });
  });

  test('files nothing once rejected', async ({ page }) => {
    const id = queuedId(await askAgent(page, CREATE));
    const dialog = await openApprovals(page);

    await dialog.locator(`[data-approval="${id}"]`).getByRole('button', { name: 'Reject' }).click();

    await expect(dialog.locator(`[data-approval="${id}"]`)).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);
    expect(await askAgent(page, { op: 'approval.status', id })).toEqual({
      ok: true,
      value: { status: 'rejected', approvalId: id },
    });
  });

  test('approve all skips the tempo sync', async ({ page }) => {
    const created = queuedId(await askAgent(page, CREATE));
    const synced = queuedId(await askAgent(page, { op: 'tempo.sync', day: E2E_DAY_KEY, planHash: 'confirmed' }));
    const dialog = await openApprovals(page);

    await dialog.getByRole('button', { name: 'Approve all (1)' }).click();

    await expect(dialog.locator(`[data-approval="${created}"]`)).toBeHidden();
    await expect(dialog.locator(`[data-approval="${synced}"]`)).toContainText('Only approved one by one');
    expect((await readBackend(page)).jira.created).toHaveLength(1);
    expect((await readBackend(page)).tempo.writes).toEqual([]);
    expect(await askAgent(page, { op: 'approval.status', id: synced })).toEqual({
      ok: true,
      value: { status: 'queued', approvalId: synced },
    });
  });

  test('answers a tempo sync plan at once, since it writes nothing', async ({ page }) => {
    const answer = await askAgent<{ planHash: string }>(page, { op: 'tempo.sync', day: E2E_DAY_KEY });

    expect(answer).toEqual({
      ok: true,
      value: expect.objectContaining({ day: E2E_DAY_KEY, planHash: expect.any(String) }),
    });
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
  });
});

test.describe('a jira issue an agent files under a parent Jira refuses the link to', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), ticket: { ...defaultSettings().ticket, parenting: 'issue-link' } },
      faults: [{ url: '/issueLink', status: 400, body: { errorMessages: ['No link type named Relates.'] } }],
    });
    await page.goto('/day');
  });

  test('answers the filed issue with why the link failed', async ({ page }) => {
    const id = queuedId(await askAgent(page, { ...CREATE, parentKey: E2E_EPIC_KEY }));
    const dialog = await openApprovals(page);

    await dialog.locator(`[data-approval="${id}"]`).getByRole('button', { name: 'Approve' }).click();

    await expect(dialog.locator(`[data-approval="${id}"]`)).toBeHidden();
    expect((await readBackend(page)).jira.created).toHaveLength(1);
    expect(await askAgent(page, { op: 'approval.status', id })).toEqual({
      ok: true,
      value: {
        status: 'approved',
        approvalId: id,
        result: {
          issue: { key: expect.any(String), id: expect.any(String) },
          linkError: expect.stringContaining('No link type named Relates.'),
        },
      },
    });
  });
});
