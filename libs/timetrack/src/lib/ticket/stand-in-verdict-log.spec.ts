import { describe, expect, it } from 'vitest';
import { createStandInVerdictLog } from './stand-in-verdict-log';

describe('createStandInVerdictLog', () => {
  it('holds nothing for a day the pass never ran on', () => {
    expect(createStandInVerdictLog().read('2026-11-18')).toEqual([]);
  });

  it('keeps the latest verdict per context and day, stamped with when it ran', () => {
    const log = createStandInVerdictLog();

    log.record({
      day: '2026-11-18',
      at: 1,
      decisions: [{ repoPath: '/a', branch: 'x', observedMs: 5, verdict: 'opens' }],
    });
    log.record({
      day: '2026-11-18',
      at: 2,
      decisions: [{ repoPath: '/a', branch: 'x', observedMs: 5, verdict: 'waiting' }],
    });
    log.record({ day: '2026-11-18', at: 4, decisions: [] });
    log.record({ day: '2026-11-19', at: 3, decisions: [{ appId: 'app', observedMs: 1, verdict: 'no-checkout' }] });

    expect(log.read('2026-11-18')).toEqual([{ repoPath: '/a', branch: 'x', observedMs: 5, verdict: 'waiting', at: 2 }]);
    expect(log.read('2026-11-19')).toHaveLength(1);
  });
});
