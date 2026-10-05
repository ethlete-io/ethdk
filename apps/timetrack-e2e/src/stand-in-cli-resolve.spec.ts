import { Page } from '@playwright/test';
import { AgentApiStandIn } from '@ethlete/timetrack';
import {
  E2E_EPIC_KEY,
  E2E_KEYLESS_BRANCH,
  E2E_PARENT_KEY,
  E2E_REPO,
  defaultSettings,
} from '@ethlete/timetrack/testing';
import { E2E_NOW, askAgent, expect, openApprovals, queuedId, seedWorld, test } from './support';

const STAND_IN = {
  id: 'stand-in-bracket',
  name: 'Bracket challenge',
  state: 'resolved' as const,
  issueKey: E2E_PARENT_KEY,
  resolvedRuleIds: ['rule-stand-in'],
  resolutionSource: 'human' as const,
  days: ['2026-08-12'],
  author: 'user' as const,
  createdAt: new Date(0),
};

const RESOLVED_RULE = {
  id: 'rule-stand-in',
  repoPath: E2E_REPO,
  branch: E2E_KEYLESS_BRANCH,
  target: { kind: 'issue' as const, issueKey: E2E_PARENT_KEY },
  author: 'user' as const,
  createdAt: new Date(0),
};

const RESOLVE = { op: 'standIn.resolve', id: STAND_IN.id, issueKey: E2E_EPIC_KEY, client: 'Claude Code' };

const bandOf = (page: Page, key: string) => page.locator(`[data-kind="row"][title^="${key}"]`);

const storedStandIn = async (page: Page) => {
  const answer = await askAgent<{ standIns: AgentApiStandIn[] }>(page, { op: 'standIn.list' });
  const standIn = answer.ok ? answer.value.standIns.find((entry) => entry.id === STAND_IN.id) : undefined;

  return standIn && { state: standIn.state, issueKey: standIn.issueKey };
};

test.describe('a resolve of a resolved stand-in a CLI asks for', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...defaultSettings(), attributionRules: [RESOLVED_RULE], standIns: [STAND_IN] },
    });
    await page.goto('/day');
    await expect(bandOf(page, E2E_PARENT_KEY)).toHaveCount(1);
  });

  test('moves the stand-in and its band to the new key once approved', async ({ page }) => {
    const heading = page.locator('ethlete-day-review header h2');
    const shown = await heading.textContent();
    const id = queuedId(await askAgent(page, RESOLVE));

    expect(await storedStandIn(page)).toEqual({ state: 'resolved', issueKey: E2E_PARENT_KEY });

    const dialog = await openApprovals(page);
    const item = dialog.locator(`[data-approval="${id}"]`);

    await expect(item).toContainText(
      `Resolves stand-in ${STAND_IN.name}: ${E2E_PARENT_KEY} → ${E2E_EPIC_KEY} Access platform`,
    );
    await item.getByRole('button', { name: 'Approve' }).click();

    await expect(item).toBeHidden();
    await expect.poll(() => storedStandIn(page)).toEqual({ state: 'resolved', issueKey: E2E_EPIC_KEY });
    await expect(bandOf(page, E2E_EPIC_KEY)).toHaveCount(1);
    await expect(bandOf(page, E2E_PARENT_KEY)).toHaveCount(0);
    await expect(heading).toHaveText(shown ?? '');
    expect(await askAgent(page, { op: 'approval.status', id })).toEqual({
      ok: true,
      value: { status: 'approved', approvalId: id, result: { standIns: expect.any(Array) } },
    });
  });

  test('leaves the stand-in as it was once rejected', async ({ page }) => {
    const heading = page.locator('ethlete-day-review header h2');
    const shown = await heading.textContent();
    const id = queuedId(await askAgent(page, RESOLVE));
    const dialog = await openApprovals(page);

    await dialog.locator(`[data-approval="${id}"]`).getByRole('button', { name: 'Reject' }).click();

    await expect(dialog.locator(`[data-approval="${id}"]`)).toBeHidden();
    expect(await storedStandIn(page)).toEqual({ state: 'resolved', issueKey: E2E_PARENT_KEY });
    await expect(bandOf(page, E2E_PARENT_KEY)).toHaveCount(1);
    await expect(heading).toHaveText(shown ?? '');
  });

  test('queues nothing for a key Jira does not hold or a stand-in Timetrack does not', async ({ page }) => {
    expect(await askAgent(page, { ...RESOLVE, issueKey: 'ABC-99999' })).toEqual({
      ok: false,
      message: expect.stringContaining('Jira has no issue ABC-99999'),
    });
    expect(await askAgent(page, { ...RESOLVE, id: 'stand-in-gone' })).toEqual({
      ok: false,
      message: 'Timetrack holds no stand-in stand-in-gone. Nothing was queued.',
    });
    expect(await askAgent(page, { op: 'approvals.list' })).toEqual({ ok: true, value: [] });
  });
});
