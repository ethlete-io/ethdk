import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from '../settings/model';
import { effectiveNoWorkContextApps, effectiveTransientApps } from '../settings/rules';
import { streamDay } from './stream-day';

const MINUTE = 60_000;
const DAY_START = new Date(2026, 8, 10, 9, 0, 0);
const AT = (minute: number) => new Date(DAY_START.getTime() + minute * MINUTE);
const REPO = '/home/tom/dev/ethlete-sdk';
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ET'] });
const READ_THROUGH = AT(200);

const focus = (minute: number, appId: string, title: string): CollectedEvent => ({
  at: AT(minute),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const focusRun = (options: { from: number; to: number; appId: string; title: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) =>
    focus(options.from + offset, options.appId, options.title),
  );

/**
 * A day that touches three of the shipped lists: a media player, a screenshot tool and a browser
 * extension popup, around one checkout.
 */
const DAY: CollectedEvent[] = [
  { at: AT(0), source: 'git', kind: 'git-checkout', repoPath: REPO, branch: 'feat/ET-772-name-the-ticket' },
  ...focusRun({ from: 0, to: 40, appId: 'code', title: 'lanes.ts - ethlete-sdk - Code' }),
  ...focusRun({ from: 41, to: 70, appId: 'spotify', title: 'Spotify Premium' }),
  ...focusRun({ from: 71, to: 100, appId: 'PrusaSlicer', title: 'PrusaSlicer 2.8' }),
  ...focusRun({ from: 101, to: 130, appId: 'com.gabm.satty', title: 'Satty' }),
  ...focusRun({ from: 131, to: 133, appId: 'chrome-hhieiojnefblcnbdbmeamnljodladlem-Default', title: 'Bitwarden' }),
  ...focusRun({ from: 134, to: 170, appId: 'code', title: 'lanes.ts - ethlete-sdk - Code' }),
];

/** A day that is nothing but the media player, so no checkout beside it can claim its blocks. */
const PLAYER_DAY: CollectedEvent[] = focusRun({ from: 0, to: 60, appId: 'spotify', title: 'Spotify Premium' });

/** The options the app builds for every reader of a day — see `dayRowsOptionsOf`. */
const rowsOf = (options: { events: readonly CollectedEvent[]; settings: TimetrackSettings }) => {
  const { settings } = options;

  return streamDay({
    events: options.events,
    options: {
      repoRoots: [REPO],
      windowsSeenThroughMs: READ_THROUGH.getTime(),
      noWorkContextApps: effectiveNoWorkContextApps(settings),
      transientApps: effectiveTransientApps(settings),
      rows: {
        config: CONFIG,
        noWorkContext: {
          apps: effectiveNoWorkContextApps(settings),
          transientApps: effectiveTransientApps(settings),
        },
      },
    },
  }).rows;
};

const laneKeys = (options: { events?: readonly CollectedEvent[]; settings?: TimetrackSettings } = {}) => {
  const rows = rowsOf({ events: options.events ?? DAY, settings: options.settings ?? DEFAULT_TIMETRACK_SETTINGS });

  return [...new Set([...rows.proposals, ...rows.unnamed].flatMap((row) => (row.laneKey ? [row.laneKey] : [])))];
};

describe('the shipped no-work lists, as the app hands them over', () => {
  it('gives a media player no lane', () => {
    expect(laneKeys()).not.toContain('app:spotify');
  });

  it('gives the other shipped no-work applications no lane', () => {
    expect(laneKeys()).not.toContain('app:prusaslicer');
    expect(laneKeys()).not.toContain('app:PrusaSlicer');
    expect(laneKeys()).not.toContain('app:com.gabm.satty');
  });

  it('gives a browser extension popup no lane', () => {
    expect(laneKeys()).not.toContain('app:chrome-hhieiojnefblcnbdbmeamnljodladlem-Default');
  });

  it('keeps the checkout the day was worked in', () => {
    expect(laneKeys()).toContain(`repo:${REPO}`);
  });

  it('gives the media player no lane on a day that is nothing else', () => {
    expect(laneKeys({ events: PLAYER_DAY })).toEqual([]);
  });

  it('gives the media player a lane again once the user says it holds work', () => {
    expect(
      laneKeys({ events: PLAYER_DAY, settings: { ...DEFAULT_TIMETRACK_SETTINGS, holdsWorkApps: ['spotify'] } }),
    ).toContain('app:spotify');
  });
});
