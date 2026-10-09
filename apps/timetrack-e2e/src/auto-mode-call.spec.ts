import { Page } from '@playwright/test';
import { CollectedEvent, TimetrackSettings } from '@ethlete/timetrack';
import { E2E_ISSUE_ID, E2E_ISSUE_KEY, defaultSettings, tempoWorklogOn } from '@ethlete/timetrack/testing';
import {
  E2E_DAY_KEY,
  E2E_NOW,
  askAgent,
  editSurface,
  expect,
  openApprovals,
  openAutoModeReadout,
  seedWorld,
  test,
} from './support';

const at = (clock: string) => new Date(`${E2E_DAY_KEY}T${clock}:00.000Z`);

const DISCORD = 'com.hnc.Discord';

const HEARD = 'we plan the invite flow for new members';

const OPENING_NOISE = 'Upp dum dum';

const chunk = (atClock: string, text: string) => ({
  atMs: at(atClock).getTime(),
  callStartedAtMs: at('14:00').getTime(),
  appId: `${DISCORD}.helper.Renderer`,
  model: 'base',
  language: 'en',
  text,
});

const callWorld = (options: { transcripts: boolean }) => {
  const base = defaultSettings();
  const settings: TimetrackSettings = {
    ...base,
    nudge: { ...base.nudge, enabled: false },
    callRules: { countsAsWork: ['Discord'], neverCountsAsWork: [] },
    transcribeCalls: true,
    reasoning: { ...base.reasoning, autoMode: true, autoModeTranscripts: options.transcripts },
  };

  return {
    now: E2E_NOW,
    events: [
      { at: at('14:00'), source: 'window', kind: 'window-focus', appId: DISCORD, title: 'Open Room #1' },
      { at: at('14:00'), source: 'call', kind: 'call-start', appId: `${DISCORD}.helper.Renderer` },
      { at: at('14:30'), source: 'call', kind: 'call-end', appId: `${DISCORD}.helper.Renderer` },
    ] satisfies CollectedEvent[],
    settings,
    transcription: {
      status: { available: true, enabled: true, listening: true },
      chunks: [chunk('14:00', OPENING_NOISE), chunk('14:05', HEARD)],
    },
    tempo: { worklogs: [tempoWorklogOn({ day: '2026-08-05', minutes: 60, issueId: E2E_ISSUE_ID })] },
  };
};

type DayRows = { rows: { laneKey?: string; issueKey?: string; sources: { issue: string } }[] };

const callRow = async (page: Page) => {
  const answer = await askAgent<DayRows>(page, { op: 'day.rows', day: E2E_DAY_KEY });

  return answer.ok ? answer.value.rows.find((row) => row.laneKey === 'lane:call') : undefined;
};

const sentCallPayload = async (page: Page) => {
  const readout = await openAutoModeReadout(page);
  const sent = readout.locator('[data-model-call-sent]').filter({ hasText: '"call"' });

  await expect(sent).toHaveCount(1);

  return (await sent.textContent()) ?? '';
};

test.describe('auto mode on an unnamed call, with transcripts let in', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorld(page, callWorld({ transcripts: true }));
    await page.goto('/day');
  });

  test('sends the call with its transcript and waits for approval before it names the band', async ({ page }) => {
    const dialog = await openApprovals(page);
    const item = dialog.locator('[data-approval]');

    await expect(item).toHaveCount(1);
    await expect(item).toContainText(`Names today's Open Room #1 call with ${E2E_ISSUE_KEY}`);

    await item.getByRole('button', { name: 'Approve' }).click();
    await expect(item).toBeHidden();
    await expect.poll(() => callRow(page)).toEqual(expect.objectContaining({ issueKey: E2E_ISSUE_KEY }));
    expect((await callRow(page))?.sources.issue).toBe('auto');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const sent = await sentCallPayload(page);

    expect(sent).toContain(HEARD);
    expect(sent).not.toContain(OPENING_NOISE);
  });

  test('lists the transcript with the evidence of the call band', async ({ page }) => {
    await page.locator('[data-kind="row"]').first().click();

    const transcript = editSurface(page).locator('[data-call-transcript]');

    await expect(transcript).toContainText(HEARD);
    await expect(transcript).not.toContainText(OPENING_NOISE);
  });
});

test.describe('auto mode on an unnamed call, with transcripts kept back', () => {
  test('asks about the call without its transcript', async ({ page }) => {
    await seedWorld(page, callWorld({ transcripts: false }));
    await page.goto('/day');

    const sent = await sentCallPayload(page);

    expect(sent).toContain('Open Room #1');
    expect(sent).not.toContain(HEARD);
  });
});

test.describe('auto mode on an unnamed call, with transcripts let in afterwards', () => {
  test('asks about the call again with its transcript, by itself', async ({ page }) => {
    await seedWorld(page, callWorld({ transcripts: false }));
    await page.goto('/day');

    expect(await sentCallPayload(page)).not.toContain(HEARD);
    await page.keyboard.press('Escape');

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Sources' }).click();
    await page.locator('[data-auto-mode-transcripts]').click();
    await page.evaluate(() => {
      window.location.hash = '#/day';
    });

    const readout = await openAutoModeReadout(page);
    const sent = readout.locator('[data-model-call-sent]').filter({ hasText: '"call"' });

    await expect(sent.filter({ hasText: HEARD })).toHaveCount(1, { timeout: 20_000 });
    await expect(sent.filter({ hasText: OPENING_NOISE })).toHaveCount(0);
    await expect(sent).toHaveCount(2);
  });
});
