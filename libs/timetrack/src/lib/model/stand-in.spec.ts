import { describe, expect, it } from 'vitest';
import { AttributionRule } from './attribution';
import {
  StandIn,
  canReopenStandIn,
  findStandIn,
  matchStandIn,
  openStandIn,
  openStandIns,
  standInDays,
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
