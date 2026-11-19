import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { CollectedEvent } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { StandIn } from '../model/stand-in';
import { streamDay } from './stream-day';

const REPO = '/home/you/dev/app-a';
const DAY = '2026-09-23';
const AT = (minutes: number) => new Date(Date.UTC(2026, 8, 23, 8, 0, 0) + minutes * 60_000);
const LINK: TimetrackProjectLink = {
  id: 'link',
  path: REPO,
  target: { kind: 'project', projectKey: 'APA' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};
const STAND_IN: StandIn = {
  id: 'stand-in-1',
  name: 'The next band',
  state: 'open',
  days: [DAY],
  author: 'user',
  createdAt: AT(0),
};
const RULE: AttributionRule = {
  id: 'rule-1',
  repoPath: REPO,
  branch: 'next',
  day: DAY,
  target: { kind: 'stand-in', standInId: STAND_IN.id },
  author: 'user',
  createdAt: AT(0),
};

const focus: CollectedEvent[] = Array.from({ length: 121 }, (_, index) => ({
  at: AT(index),
  source: 'window',
  kind: 'window-focus',
  appId: 'jetbrains-webstorm',
  title: 'app-a – upload.component.ts',
}));

const standInIdsOn = (day: string) =>
  streamDay({
    events: focus,
    options: {
      repoRoots: [REPO],
      links: [LINK],
      baseBranches: ['main', 'next'],
      headBranches: { [REPO]: 'next' },
      day,
      rows: { rules: [RULE], standIns: [STAND_IN] },
    },
  }).rows.unnamed.map((row) => row.standInId);

describe('streamDay with a day-scoped stand-in rule', () => {
  it('names the band on the rule day', () => {
    expect(standInIdsOn(DAY)).toContain(STAND_IN.id);
  });

  it('leaves the band unnamed on the next day', () => {
    expect(standInIdsOn('2026-09-24')).not.toContain(STAND_IN.id);
  });
});
