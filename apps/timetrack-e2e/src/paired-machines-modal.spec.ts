import { FakePairedMachine } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, seedWorld, test } from './support';

const AT = new Date(E2E_NOW).getTime();

const MACBOOK: FakePairedMachine = {
  machineId: 'mac-1',
  label: 'Tom-Runes-MacBook-Pro.local',
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: AT - 30_000,
  clockOffsetMs: 2_000,
  pairedAtMs: AT - 86_400_000,
  lastPullMs: AT - 5 * 60_000,
};

test.describe('the paired machines modal', () => {
  test('opens from the sidebar, renames a machine and forgets it', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { paired: [MACBOOK] } });
    await page.goto('/day');

    await page.locator('[data-peers-status]').click();

    const modal = page.locator('[data-paired-machines-modal]');
    const row = modal.locator('[data-paired-machine]');

    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-machine-name] input')).toHaveValue('Tom-Runes-MacBook-Pro.local');
    await expect(row.locator('[data-paired-last-seen]')).toHaveText('Last seen just now');
    await expect(row.locator('[data-paired-last-sync]')).toHaveText('Synced 5m ago');
    await expect(row.locator('[data-clock-offset="ok"]')).toBeVisible();

    await row.locator('[data-machine-name] input').fill('MacBook');
    await row.locator('[data-machine-rename]').click();

    await expect(row.locator('[data-machine-name] input')).toHaveValue('MacBook');
    await expect(page.locator('[data-peers-status]')).toHaveAttribute('title', 'Connected: MacBook');

    await row.getByRole('button', { name: 'Forget MacBook' }).click();

    await expect(row).toHaveCount(0);
    await expect(modal).toContainText('No machine is paired.');
  });

  test('shows a code to pair another machine from the modal', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { paired: [MACBOOK], code: '246810' } });
    await page.goto('/day');

    await page.locator('[data-peers-status]').click();
    await page.locator('[data-paired-machines-modal]').getByRole('button', { name: 'Show code' }).click();

    await expect(page.locator('[data-paired-machines-modal] [data-pair-offer-code]')).toHaveText('246810');
  });
});
