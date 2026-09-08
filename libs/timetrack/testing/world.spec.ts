import { describe, expect, it } from 'vitest';
import { E2E_ISSUE_KEY, E2E_REPO, createFakeWorld, e2eAt, e2eLocalDay, parseWorldSeed, tempoWorklogOn } from './world';

describe('createFakeWorld', () => {
  it('describes one reconstructable morning when the seed states nothing', () => {
    const world = createFakeWorld();

    expect(world.events.length).toBeGreaterThan(0);
    expect(world.settings.gitScanRoots).toEqual([E2E_REPO]);
    expect(world.backend.jira.issues.map((issue) => issue.key)).toContain(E2E_ISSUE_KEY);
  });

  it('holds an empty Tempo, so a sync spec starts from nothing logged', () => {
    expect(createFakeWorld().backend.tempo).toEqual({ worklogs: [], workAttributes: [], writes: [] });
  });

  it('replaces one key of a provider and keeps the rest of it', () => {
    const world = createFakeWorld({ jira: { issues: [] } });

    expect(world.backend.jira.issues).toEqual([]);
    expect(world.backend.jira.projects).toEqual([{ key: 'ABC', name: 'Alpha' }]);
  });

  it('starts a fresh request log and id counter for every page load', () => {
    expect(createFakeWorld().backend).toMatchObject({ requests: [], faults: [], nextId: 11000 });
  });
});

describe('parseWorldSeed', () => {
  it('reads an absent seed as an empty world', () => {
    expect(parseWorldSeed(null)).toEqual({});
    expect(parseWorldSeed('')).toEqual({});
  });

  it('revives the one field JSON cannot carry', () => {
    const at = e2eAt(9, 0);
    const raw = JSON.stringify({ events: [{ at, source: 'idle', kind: 'idle-start' }] });

    const seed = parseWorldSeed(raw);

    expect(seed.events?.[0]?.at).toEqual(at);
  });

  it('keeps the rest of the seed as it crossed', () => {
    const seed = parseWorldSeed(JSON.stringify({ faults: [{ url: '/worklogs', status: 401 }] }));

    expect(seed.faults).toEqual([{ url: '/worklogs', status: 401 }]);
  });
});

describe('tempoWorklogOn', () => {
  it('dates a worklog by the local calendar day, not by UTC', () => {
    const lateEvening = new Date(2026, 7, 12, 23, 30);

    expect(tempoWorklogOn({ day: lateEvening, minutes: 30 }).startDate).toBe('2026-08-12');
  });

  it('takes a day key as it is spelled', () => {
    expect(tempoWorklogOn({ day: '2026-08-12', minutes: 30 }).startDate).toBe('2026-08-12');
  });

  it('states the time in seconds, the unit Tempo counts in', () => {
    expect(tempoWorklogOn({ day: '2026-08-12', minutes: 90 }).timeSpentSeconds).toBe(5400);
  });
});

describe('e2eLocalDay', () => {
  it('pads the month and the day', () => {
    expect(e2eLocalDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
