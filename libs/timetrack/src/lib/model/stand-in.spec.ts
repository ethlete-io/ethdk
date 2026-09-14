import { describe, expect, it } from 'vitest';
import { AttributionRule } from './attribution';
import { StandIn, findStandIn, matchStandIn, standInDays } from './stand-in';

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
