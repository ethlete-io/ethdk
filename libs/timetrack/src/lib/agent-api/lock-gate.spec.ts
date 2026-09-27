import { describe, expect, it } from 'vitest';
import { AGENT_API_LOCKED_MESSAGE, agentApiLockRefusal } from './lock-gate';
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

describe('AGENT_API_OP_CLASSES', () => {
  it('keeps the Tempo writes and the stand-in delete for the human', () => {
    expect(opsOf('human-only')).toEqual(['standIn.remove', 'tempo.delete', 'tempo.sync']);
  });

  it('classes the Jira create as external', () => {
    expect(opsOf('external')).toEqual(['jira.create']);
  });

  it('classes the local day and stand-in edits as local', () => {
    expect(opsOf('local')).toEqual([
      'agentSessions.resync',
      'day.edits',
      'standIn.rename',
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
