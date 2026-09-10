import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { TimetrackProjectLink } from '../model/project-link';
import { privateTime } from './project-link';

const link = (options: Partial<TimetrackProjectLink> & Pick<TimetrackProjectLink, 'path' | 'target'>) => ({
  id: options.path,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  ...options,
});

const secluded = link({ path: '/home/tom/dev/private', target: { kind: 'private' } });

const block = (options: { from: string; to: string }): ActivityBlock => ({
  from: new Date(options.from),
  to: new Date(options.to),
  context: { repoPath: '/home/tom/dev/private' },
  evidence: [],
});

describe('privateTime', () => {
  it('folds every block of one link into one entry, largest first', () => {
    const other = link({ path: '/home/tom/dev/other', target: { kind: 'private' } });
    const folded = privateTime({
      blocks: [
        { block: block({ from: '2026-08-16T09:00:00Z', to: '2026-08-16T09:30:00Z' }), link: secluded },
        { block: block({ from: '2026-08-16T11:00:00Z', to: '2026-08-16T11:10:00Z' }), link: other },
        { block: block({ from: '2026-08-16T13:00:00Z', to: '2026-08-16T13:20:00Z' }), link: secluded },
      ],
    });

    expect(folded).toEqual([
      {
        link: secluded,
        observedMs: 50 * 60_000,
        from: new Date('2026-08-16T09:00:00Z'),
        to: new Date('2026-08-16T13:20:00Z'),
      },
      {
        link: other,
        observedMs: 10 * 60_000,
        from: new Date('2026-08-16T11:00:00Z'),
        to: new Date('2026-08-16T11:10:00Z'),
      },
    ]);
  });

  it('answers with nothing when the day had none', () => {
    expect(privateTime({ blocks: [] })).toEqual([]);
  });
});
