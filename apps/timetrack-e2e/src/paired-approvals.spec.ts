import { AgentApproval } from '@ethlete/timetrack';
import { FakePairedMachine } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  expect,
  openApprovals,
  readBackend,
  readSentApprovals,
  seedWorld,
  test,
} from './support';

const AT = new Date(E2E_NOW).getTime();

const MACBOOK: FakePairedMachine = {
  machineId: 'mac-1',
  label: 'MacBook',
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: AT - 30_000,
  clockOffsetMs: 0,
  pairedAtMs: AT - 86_400_000,
  lastPullMs: AT - 30_000,
};

const create = (id: string, summary: string, over: Partial<AgentApproval> = {}): AgentApproval => ({
  id,
  request: { op: 'jira.create', projectKey: 'ABC', summary, description: '' },
  opClass: 'external',
  client: 'Claude Code',
  askedAtMs: AT - 60_000,
  day: E2E_DAY_KEY,
  state: 'queued',
  ...over,
});

test.describe('the approval queue of paired machines', () => {
  test('shows an item the paired machine queued, and only that machine files it once approved here', async ({
    page,
  }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      peers: { paired: [MACBOOK], approvals: [{ machineId: 'mac-1', queue: [create('peer-1', 'Pdf export')] }] },
    });
    await page.goto('/day');

    const dialog = await openApprovals(page);
    const item = dialog.locator('[data-approval="peer-1"]');

    await expect(item).toContainText('Pdf export → new issue in ABC');
    await item.getByRole('button', { name: 'Approve' }).click();

    await expect(item).toBeHidden();
    await expect
      .poll(async () => (await readSentApprovals(page))?.find((sent) => sent.id === 'peer-1'))
      .toEqual(
        expect.objectContaining({ state: 'approved', ownerMachineId: 'mac-1', decidedAtMs: expect.any(Number) }),
      );
    expect((await readBackend(page)).jira.created).toEqual([]);
  });

  test('takes an item the paired machine already filed as done, so it cannot be approved again here', async ({
    page,
  }) => {
    const filed = { issue: { key: 'ABC-77', id: '77' } };

    await seedWorld(page, {
      now: E2E_NOW,
      approvals: [create('peer-2', 'Csv export', { ownerMachineId: 'mac-1' })],
      peers: {
        paired: [MACBOOK],
        approvals: [
          {
            machineId: 'mac-1',
            queue: [create('peer-2', 'Csv export', { state: 'approved', decidedAtMs: AT - 1_000, result: filed })],
          },
        ],
      },
    });
    await page.goto('/day');

    await expect
      .poll(() => askAgent(page, { op: 'approval.status', id: 'peer-2' }))
      .toEqual({ ok: true, value: { status: 'approved', approvalId: 'peer-2', result: filed } });
    await expect(page.getByRole('button', { name: 'Review requests' })).toBeHidden();
    expect((await readBackend(page)).jira.created).toEqual([]);
  });
  test('lists an item the paired machine approved and owns but has not run yet, without actions', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      peers: {
        paired: [MACBOOK],
        approvals: [
          {
            machineId: 'mac-1',
            queue: [
              create('peer-3', 'Xml export', { state: 'approved', decidedAtMs: AT - 1_000, ownerMachineId: 'mac-1' }),
              create('peer-4', 'Json export'),
            ],
          },
        ],
      },
    });
    await page.goto('/day');

    const dialog = await openApprovals(page);
    const item = dialog.locator('[data-approval="peer-3"]');

    await expect(item).toContainText('Xml export → new issue in ABC');
    await expect(item).toContainText('approved on MacBook');
    await expect(item.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(item.getByRole('button', { name: 'Reject' })).toHaveCount(0);
    await expect(dialog.locator('[data-approval="peer-4"]').getByRole('button', { name: 'Approve' })).toBeVisible();
  });

  test('does not list an item this machine approved as approved elsewhere once the app restarted', async ({ page }) => {
    const approvedHere = create('peer-5', 'Csv export', {
      state: 'approved',
      decidedAtMs: AT - 1_000,
      decidedBy: 'this-machine',
      ownerMachineId: 'mac-1',
    });

    await seedWorld(page, {
      now: E2E_NOW,
      approvals: [approvedHere],
      peers: {
        paired: [MACBOOK],
        approvals: [
          {
            machineId: 'mac-1',
            queue: [create('peer-5', 'Csv export', { ownerMachineId: 'mac-1' }), create('peer-6', 'Ods export')],
          },
        ],
      },
    });
    await page.goto('/day');

    const dialog = await openApprovals(page);

    await expect(dialog.locator('[data-approval="peer-6"]')).toBeVisible();
    await expect(dialog.locator('[data-approval="peer-5"]')).toHaveCount(0);
    await expect(dialog).not.toContainText('approved on MacBook');
  });
});
