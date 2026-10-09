import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_API_LOCKED_MESSAGE, agentApiLockRefusal, agentApiLockRefusal$ } from './lock-gate';
import { AGENT_API_OP_CLASSES, AgentApiOp, OpClass } from './model';

const opsOf = (opClass: OpClass) =>
  (Object.keys(AGENT_API_OP_CLASSES) as AgentApiOp[]).filter((op) => AGENT_API_OP_CLASSES[op] === opClass).sort();

describe('agentApiLockRefusal', () => {
  it('refuses while locked', () => {
    expect(agentApiLockRefusal({ locked: true })).toBe(AGENT_API_LOCKED_MESSAGE);
  });

  it('lets every op through while unlocked', () => {
    expect(agentApiLockRefusal({ locked: false })).toBeNull();
  });
});

describe('agentApiLockRefusal$', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const answerOf = (locked$: BehaviorSubject<boolean>) => {
    const answers: (string | null)[] = [];

    agentApiLockRefusal$(locked$, 5_000).subscribe((answer) => answers.push(answer));

    return answers;
  };

  it('lets the op through at once while the window is unlocked', () => {
    expect(answerOf(new BehaviorSubject(false))).toEqual([null]);
  });

  it('lets the op through once the window hears of the unlock inside the grace', () => {
    const locked$ = new BehaviorSubject(true);
    const answers = answerOf(locked$);

    vi.advanceTimersByTime(4_000);
    expect(answers).toEqual([]);

    locked$.next(false);
    expect(answers).toEqual([null]);
  });

  it('refuses once the grace runs out with the window still locked', () => {
    const answers = answerOf(new BehaviorSubject(true));

    vi.advanceTimersByTime(5_000);

    expect(answers).toEqual([AGENT_API_LOCKED_MESSAGE]);
  });
});

describe('AGENT_API_OP_CLASSES', () => {
  it('keeps the Tempo writes and the stand-in delete for the human', () => {
    expect(opsOf('human-only')).toEqual(['standIn.merge', 'standIn.remove', 'tempo.delete', 'tempo.sync']);
  });

  it('classes the Jira create as external', () => {
    expect(opsOf('external')).toEqual(['jira.create']);
  });

  it('classes the local day and stand-in edits as local', () => {
    expect(opsOf('local')).toEqual([
      'agentSessions.resync',
      'day.edits',
      'standIn.rename',
      'standIn.resolve',
      'standIn.split',
      'worklog.add',
    ]);
  });

  it('classes the pure reads as read', () => {
    expect(opsOf('read')).toEqual(
      expect.arrayContaining(['day.rows', 'jira.search', 'standIn.list', 'tempo.worklogs', 'settings.rules']),
    );
  });
});
