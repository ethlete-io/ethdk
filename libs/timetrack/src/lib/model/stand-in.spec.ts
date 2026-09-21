import { describe, expect, it } from 'vitest';
import { AttributionRule } from './attribution';
import {
  StandIn,
  canReopenStandIn,
  findStandIn,
  matchStandIn,
  openStandIn,
  openStandIns,
  standInAge,
  standInDays,
  standInHeldMs,
  standInWhere,
  workdaysBetween,
} from './stand-in';

const standIn = (overrides: Partial<StandIn> = {}): StandIn => ({
  id: 'stand-in-1',
  name: 'Competition Journey',
  state: 'open',
  days: [],
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/home/tom/dev/ea-frontend',
  target: { kind: 'stand-in', standInId: 'stand-in-1' },
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

describe('matchStandIn', () => {
  it('reads the stand-in a matching rule points at', () => {
    const open = standIn();

    expect(
      matchStandIn({ context: { repoPath: '/home/tom/dev/ea-frontend' }, rules: [rule()], standIns: [open] }),
    ).toBe(open);
  });

  it('answers nothing where a narrower rule names an issue', () => {
    const rules = [rule(), rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-100' } })];

    expect(
      matchStandIn({
        context: { repoPath: '/home/tom/dev/ea-frontend', branch: 'next' },
        rules,
        standIns: [standIn()],
      }),
    ).toBeUndefined();
  });

  it('answers nothing for a rule pointing at a stand-in that was deleted', () => {
    expect(
      matchStandIn({ context: { repoPath: '/home/tom/dev/ea-frontend' }, rules: [rule()], standIns: [] }),
    ).toBeUndefined();
  });

  it('answers nothing for a context no rule covers', () => {
    expect(
      matchStandIn({ context: { repoPath: '/home/tom/dev/other' }, rules: [rule()], standIns: [standIn()] }),
    ).toBeUndefined();
  });
});

describe('findStandIn', () => {
  it('answers nothing for an id nothing holds', () => {
    expect(findStandIn({ id: 'stand-in-2', standIns: [standIn()] })).toBeUndefined();
  });
});

describe('standInWhere', () => {
  it('names the directory a piece was cut to, under its checkout', () => {
    expect(
      standInWhere({
        openedFor: '/home/tom/dev/fifagg/specs',
        openedForBranch: 'main',
        openedForWorkPath: 'context/tracks/20260911_competition-journey-overlay',
      }),
    ).toBe('specs, context/tracks/20260911_competition-journey-overlay');
  });

  it('names the branch where no directory cut it', () => {
    expect(
      standInWhere({ openedFor: '/home/tom/dev/fifagg-frontend', openedForBranch: 'feature/20260911_overlay' }),
    ).toBe('fifagg-frontend, on feature/20260911_overlay');
  });

  it('names the checkout alone where neither says more', () => {
    expect(standInWhere({ openedFor: '/home/tom/dev/fifagg-frontend' })).toBe('fifagg-frontend');
  });

  it('says nothing for a record the user wrote by hand', () => {
    expect(standInWhere({})).toBe('');
  });
});

describe('standInDays', () => {
  it('adds a day once and keeps the list ordered', () => {
    expect(standInDays({ standIn: { days: ['2026-09-15', '2026-09-14'] }, day: '2026-09-15' })).toEqual([
      '2026-09-14',
      '2026-09-15',
    ]);
  });
});

describe('openStandIn', () => {
  const NOW = new Date('2026-09-14T09:30:00.000Z');

  it('opens on the day the user pressed on, so a resolve can name it later', () => {
    const opened = openStandIn({ name: 'The export nobody filed yet', day: '2026-09-14', now: NOW });

    expect(opened.state).toBe('open');
    expect(opened.days).toEqual(['2026-09-14']);
    expect(opened.author).toBe('user');
  });

  it('trims the name and leaves out a project nobody named', () => {
    const opened = openStandIn({ name: '  Padded  ', day: '2026-09-14', now: NOW });

    expect(opened.name).toBe('Padded');
    expect(opened.projectKey).toBeUndefined();
  });

  it('names the same id for the same instant, so the act is readable back', () => {
    const first = openStandIn({ name: 'One', day: '2026-09-14', now: NOW });
    const second = openStandIn({ name: 'Two', day: '2026-09-14', now: NOW });

    expect(first.id).toBe(second.id);
  });
});

describe('openStandIns', () => {
  it('lists what still waits on a ticket, newest first', () => {
    const older = standIn({ id: 'a', createdAt: new Date('2026-09-10T00:00:00.000Z') });
    const newer = standIn({ id: 'b', createdAt: new Date('2026-09-14T00:00:00.000Z') });
    const done = standIn({ id: 'c', state: 'resolved', issueKey: 'ABC-1' });

    expect(openStandIns([older, done, newer]).map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('canReopenStandIn', () => {
  const resolved = standIn({ state: 'resolved', issueKey: 'ABC-1', days: ['2026-09-14', '2026-09-15'] });

  it('lets a resolve be undone while none of its days reached tempo', () => {
    expect(canReopenStandIn({ standIn: resolved, syncedDays: ['2026-09-13'] })).toBe(true);
  });

  it('refuses once one of its days holds a worklog, which carries the key this app cannot reach', () => {
    expect(canReopenStandIn({ standIn: resolved, syncedDays: ['2026-09-15'] })).toBe(false);
  });

  it('refuses for a stand-in that was never resolved, because there is nothing to undo', () => {
    expect(canReopenStandIn({ standIn: standIn({ days: ['2026-09-14'] }), syncedDays: [] })).toBe(false);
  });
});

/** A Monday, so every span in these tests is read against a known weekday. */
const MONDAY = new Date(2026, 8, 14);

const on = (day: number) => new Date(2026, 8, day);

describe('workdaysBetween', () => {
  it('counts no day at all on the day it was opened', () => {
    expect(workdaysBetween({ from: MONDAY, to: MONDAY })).toBe(0);
  });

  it('counts each weekday after it', () => {
    expect(workdaysBetween({ from: MONDAY, to: on(15) })).toBe(1);
    expect(workdaysBetween({ from: MONDAY, to: on(18) })).toBe(4);
  });

  it('does not age a debt over a weekend', () => {
    expect(workdaysBetween({ from: on(18), to: on(21) })).toBe(1);
  });

  it('counts five a week, so a fortnight is ten', () => {
    expect(workdaysBetween({ from: MONDAY, to: on(28) })).toBe(10);
  });

  it('answers zero rather than a negative age for a date before it', () => {
    expect(workdaysBetween({ from: on(18), to: MONDAY })).toBe(0);
  });
});

describe('standInHeldMs', () => {
  const row = (standInId: string | undefined, durationMs: number) => ({ standInId, durationMs });

  it('totals only the rows this stand-in names', () => {
    const rows = [row('a', 60_000), row('b', 30_000), row(undefined, 90_000), row('a', 15_000)];

    expect(standInHeldMs({ id: 'a', rows })).toBe(75_000);
  });

  it('totals nothing when no row names it', () => {
    expect(standInHeldMs({ id: 'a', rows: [row('b', 60_000)] })).toBe(0);
  });
});

describe('standInAge', () => {
  const age = (options: { standIn?: Partial<StandIn>; heldMs?: number; now?: Date }) =>
    standInAge({
      standIn: standIn({ createdAt: MONDAY, ...options.standIn }),
      heldMs: options.heldMs ?? 0,
      now: options.now ?? on(15),
      overdueAfterWorkdays: 5,
      overdueAfterMs: 4 * 3_600_000,
    });

  it('waits for the limit before it says a stand-in waited long enough', () => {
    expect(age({ now: on(18) })).toMatchObject({ workdays: 4, isOverdue: false });
    expect(age({ now: on(21) })).toMatchObject({ workdays: 5, isOverdue: true });
  });

  it('marks work that piled up, however new it is', () => {
    expect(age({ heldMs: 4 * 3_600_000 })).toMatchObject({ workdays: 1, isOverdue: true });
  });

  it('never marks one that is already resolved', () => {
    expect(age({ standIn: { state: 'resolved' }, now: on(28) }).isOverdue).toBe(false);
  });

  it('turns a limit off when it is zero', () => {
    const off = standInAge({
      standIn: standIn({ createdAt: MONDAY }),
      heldMs: 8 * 3_600_000,
      now: on(28),
      overdueAfterWorkdays: 0,
      overdueAfterMs: 0,
    });

    expect(off.isOverdue).toBe(false);
  });
});
