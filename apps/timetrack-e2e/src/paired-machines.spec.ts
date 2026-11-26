import { FakeDiscoveredMachine, FakePairedMachine } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const AT = new Date(E2E_NOW).getTime();
const CODE = '246810';

const MACBOOK: FakeDiscoveredMachine = {
  machineId: 'mac-1',
  label: 'MacBook',
  addresses: ['192.168.1.20'],
  port: 52741,
  fingerprint: 'fp-mac',
  paired: false,
  lastSeenMs: AT,
};

const paired = (overrides: Partial<FakePairedMachine>): FakePairedMachine => ({
  machineId: 'mac-1',
  label: 'MacBook',
  certFingerprint: 'fp-mac',
  lastAddr: '192.168.1.20:52741',
  lastSeenMs: AT - 30_000,
  clockOffsetMs: 2_000,
  pairedAtMs: AT - 86_400_000,
  lastPullMs: null,
  ...overrides,
});

const openSources = async (page: Page) => {
  await page.goto('/day');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Sources' }).click();
};

const section = (page: Page) => page.locator('[data-paired-machines]');

const pairWith = async (page: Page, code: string) => {
  await section(page).locator('[data-discovered-machine]', { hasText: 'MacBook' }).click();
  await section(page).locator('[data-pair-code] input').fill(code);
  await section(page).getByRole('button', { name: 'Pair', exact: true }).click();
};

test.describe('paired machines', () => {
  test('pairs a discovered machine with the code it shows', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { discovered: [MACBOOK], code: CODE } });
    await openSources(page);

    await expect(section(page)).toContainText('No machine is paired.');
    await pairWith(page, CODE);

    await expect(section(page).locator('[data-pair-done]')).toHaveText('Paired with MacBook.');

    const row = section(page).locator('[data-paired-machine]');

    await expect(row).toContainText('MacBook');
    await expect(row.locator('[data-paired-last-seen]')).toHaveText('Last seen just now');
    await expect(row.locator('[data-clock-offset="ok"]')).toBeVisible();
    await expect(section(page).locator('[data-discovered-machine]')).toHaveCount(0);
  });

  test('says the code was wrong and pairs nothing', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { discovered: [MACBOOK], code: CODE } });
    await openSources(page);

    await pairWith(page, '135791');

    await expect(section(page).locator('[data-pair-failure]')).toContainText(
      'The code does not match the one the other machine shows',
    );
    await expect(section(page).locator('[data-paired-machine]')).toHaveCount(0);
  });

  test('says an offer expired, and that nothing answered at a typed address', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { discovered: [MACBOOK], offerExpired: true } });
    await openSources(page);

    await pairWith(page, CODE);
    await expect(section(page).locator('[data-pair-failure]')).toContainText('has expired');

    await section(page).locator('[data-pair-address] input').fill('10.0.0.9:4000');
    await section(page).locator('[data-pair-code] input').fill(CODE);
    await section(page).getByRole('button', { name: 'Pair', exact: true }).click();
    await expect(section(page).locator('[data-pair-failure]')).toContainText('Nothing answered at 10.0.0.9:4000');
  });

  test('shows a code to type on the other machine', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { code: CODE } });
    await openSources(page);

    await section(page).getByRole('button', { name: 'Show code' }).click();

    await expect(section(page).locator('[data-pair-offer-code]')).toHaveText(CODE);
  });

  test('forgets a paired machine', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { paired: [paired({})] } });
    await openSources(page);

    await section(page).getByRole('button', { name: 'Forget MacBook' }).click();

    await expect(section(page).locator('[data-paired-machine]')).toHaveCount(0);
    await expect(page.locator('[data-peers-status]')).toHaveCount(0);
  });

  test('names a machine whose clock is too far off', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { paired: [paired({ clockOffsetMs: -15 * 60_000 })] } });
    await openSources(page);

    await expect(section(page).locator('[data-clock-offset="error"]')).toContainText("MacBook's clock is 15m behind");
  });
});

test.describe('the connected machines in the sidebar', () => {
  test('counts a machine that said hello in the last 3 minutes', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      peers: {
        paired: [
          paired({}),
          paired({ machineId: 'old-1', label: 'Old laptop', certFingerprint: 'fp-old', lastSeenMs: AT - 3_600_000 }),
        ],
      },
    });
    await page.goto('/day');

    const status = page.locator('[data-peers-status]');

    await expect(status).toContainText('1 connected');
    await expect(status).toHaveAttribute('title', 'Connected: MacBook');
  });

  test('shows none connected when the paired machine went quiet', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, peers: { paired: [paired({ lastSeenMs: AT - 600_000 })] } });
    await page.goto('/day');

    await expect(page.locator('[data-peers-status]')).toContainText('0 connected');
  });

  test('stays out of the way while no machine is paired', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW });
    await page.goto('/day');

    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('[data-peers-status]')).toHaveCount(0);
  });
});
