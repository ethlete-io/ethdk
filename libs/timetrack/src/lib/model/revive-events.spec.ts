import { describe, expect, it } from 'vitest';
import { reviveCollectedEvents } from './revive-events';

describe('reviveCollectedEvents', () => {
  it('turns the ISO strings of a written day back into Dates', () => {
    const written = JSON.stringify({
      day: '2026-11-17',
      events: [
        { at: new Date('2026-11-17T08:00:00.000Z'), source: 'window', kind: 'window-focus', appName: 'Code' },
        {
          at: new Date('2026-11-17T09:00:00.000Z'),
          source: 'git',
          kind: 'git-commit',
          authoredAt: new Date('2026-11-17T08:59:00.000Z'),
        },
        {
          at: new Date('2026-11-17T10:00:00.000Z'),
          source: 'calendar',
          kind: 'calendar-event',
          until: new Date('2026-11-17T11:00:00.000Z'),
        },
      ],
    });

    const events = reviveCollectedEvents(JSON.parse(written).events);

    expect(events[0]).toMatchObject({ at: new Date('2026-11-17T08:00:00.000Z') });
    expect(events[1]).toMatchObject({ authoredAt: new Date('2026-11-17T08:59:00.000Z') });
    expect(events[2]).toMatchObject({ until: new Date('2026-11-17T11:00:00.000Z') });
    expect(events[0]).toMatchObject({ appName: 'Code' });
  });
});
