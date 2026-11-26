import { CollectedEvent } from '@ethlete/timetrack';
import { defaultSettings } from '@ethlete/timetrack/testing';
import { expect, openDayNotes, seedWorld, test } from './support';

const NOW = '2026-10-09T18:00:00.000Z';

const SDK = '/Users/e2e/dev/ethlete-sdk';

const turn = (model: string): CollectedEvent => ({
  at: new Date('2026-10-09T09:30:00.000Z'),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: 'session-priced',
  turnId: 'turn-priced',
  cwd: SDK,
  model,
  usage: { input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 },
});

test.describe('the cost of agent spend', () => {
  test('shows a cost for a built-in model with an empty price table', async ({ page }) => {
    await seedWorld(page, {
      now: NOW,
      events: [turn('claude-opus-5')],
      settings: { ...defaultSettings(), priceTable: { currency: 'USD', prices: [] } },
    });
    await page.goto('/day');
    await openDayNotes(page);

    await expect(page.locator('[data-cost]')).toHaveText('$5.00');
  });

  test('names a model the built-in list does not know, with no cost', async ({ page }) => {
    await seedWorld(page, {
      now: NOW,
      events: [turn('claude-unheard-of')],
      settings: { ...defaultSettings(), priceTable: { currency: 'USD', prices: [] } },
    });
    await page.goto('/day');
    await openDayNotes(page);

    await expect(page.locator('[data-cost]')).toHaveText('no price for claude-code · claude-unheard-of');
  });
});
