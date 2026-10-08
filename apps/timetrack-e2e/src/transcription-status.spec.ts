import { defaultSettings } from '@ethlete/timetrack/testing';
import { Page } from '@playwright/test';
import { E2E_NOW, expect, seedWorld, test } from './support';

const openSources = async (page: Page) => {
  await page.goto('/day');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Sources' }).click();
};

const ENABLED = { ...defaultSettings(), transcribeCalls: true };
const AT = new Date(E2E_NOW).getTime();

test.describe('the call transcription readout', () => {
  test('stays out of the way in a build without the engine', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, settings: ENABLED });
    await openSources(page);

    await expect(page.locator('[data-transcription]')).toHaveCount(0);
  });

  test('says it is off until the user turns it on', async ({ page }) => {
    await seedWorld(page, { now: E2E_NOW, transcription: { status: { available: true } } });
    await openSources(page);

    await expect(page.locator('[data-transcription-phase]')).toHaveText('Off');
    await expect(page.locator('[data-transcription-recent]')).toHaveCount(0);
  });

  test('shows what it transcribed, when, and for how long', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: ENABLED,
      transcription: {
        status: {
          available: true,
          enabled: true,
          listening: true,
          transcribing: true,
          model: 'large-v3-turbo-q8_0',
          lastTranscribedAtMs: AT,
          lastDurationMs: 4200,
          chunksStored: 2,
        },
        chunks: [
          {
            atMs: AT,
            callStartedAtMs: AT,
            appId: 'slack',
            model: 'm',
            language: 'de',
            text: 'Wir verschieben den Release.',
          },
        ],
      },
    });
    await openSources(page);

    await expect(page.locator('[data-transcription-phase]')).toHaveText('Transcribing');
    await expect(page.locator('[data-transcription-last]')).toContainText('4.2 s');
    await expect(page.locator('[data-transcription-last]')).toContainText('2 chunks');
    await expect(page.locator('[data-transcription-chunk]')).toContainText('Wir verschieben den Release.');
  });

  test('shows the last error', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: ENABLED,
      transcription: { status: { available: true, enabled: true, error: 'whisper: out of memory' } },
    });
    await openSources(page);

    await expect(page.locator('[data-transcription-phase]')).toHaveText('Error');
    await expect(page.locator('[data-transcription-error]')).toContainText('out of memory');
  });

  test('picks the language from the engine list instead of a typed code', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: { ...ENABLED, transcribeLanguage: 'Deutsch' as never },
      transcription: { status: { available: true, enabled: true } },
    });
    await openSources(page);

    await page.locator('[data-transcription] et-select').click();

    await expect(page.getByRole('option', { name: 'Swedish' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Detect per chunk' })).toBeVisible();
  });
});
