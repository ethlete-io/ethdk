import { describe, expect, it } from 'vitest';
import { parseAgentRequest } from './parse';

describe('parseAgentRequest', () => {
  it('reads an issue lookup and uppercases the key', () => {
    expect(parseAgentRequest({ op: 'jira.issue', key: ' fip-2177 ' })).toEqual({
      ok: true,
      request: { op: 'jira.issue', key: 'FIP-2177' },
    });
  });

  it('takes an instance read with nothing but its op', () => {
    expect(parseAgentRequest({ op: 'jira.instance' })).toEqual({
      ok: true,
      request: { op: 'jira.instance' },
    });
  });

  it('names the missing field rather than the operation', () => {
    expect(parseAgentRequest({ op: 'jira.issue' })).toEqual({
      ok: false,
      message: 'jira.issue needs a key.',
    });
  });

  it('takes a search with nothing but its op, because an empty text is every issue', () => {
    expect(parseAgentRequest({ op: 'jira.search' })).toEqual({
      ok: true,
      request: { op: 'jira.search', text: '', projectKey: undefined, assignedToMe: false, limit: undefined },
    });
  });

  it('reads only a literal true as assignedToMe', () => {
    const parsed = parseAgentRequest({ op: 'jira.search', text: 'x', assignedToMe: 'yes' });

    expect(parsed).toEqual({
      ok: true,
      request: { op: 'jira.search', text: 'x', projectKey: undefined, assignedToMe: false, limit: undefined },
    });
  });

  it('refuses a worklog with no duration', () => {
    expect(parseAgentRequest({ op: 'worklog.add', issueKey: 'FIP-1', fromMs: 1, durationMs: 0 })).toEqual({
      ok: false,
      message: 'worklog.add needs a durationMs above zero.',
    });
  });

  it('reads a worklog in full', () => {
    expect(
      parseAgentRequest({
        op: 'worklog.add',
        issueKey: 'fip-1',
        description: ' a call ',
        fromMs: 1_700_000_000_000,
        durationMs: 900_000,
      }),
    ).toEqual({
      ok: true,
      request: {
        op: 'worklog.add',
        issueKey: 'FIP-1',
        description: 'a call',
        fromMs: 1_700_000_000_000,
        durationMs: 900_000,
      },
    });
  });

  it('takes the rules op, which carries no field of its own', () => {
    expect(parseAgentRequest({ op: 'settings.rules' })).toEqual({ ok: true, request: { op: 'settings.rules' } });
  });

  it('takes the stand-in list op, which carries no field of its own', () => {
    expect(parseAgentRequest({ op: 'standIn.list' })).toEqual({ ok: true, request: { op: 'standIn.list' } });
  });

  it('takes the stand-in delete op with the id it names', () => {
    expect(parseAgentRequest({ op: 'standIn.remove', id: 'stand-in:1:repo' })).toEqual({
      ok: true,
      request: { op: 'standIn.remove', id: 'stand-in:1:repo' },
    });
  });

  it('takes the approval status op with the id it names', () => {
    expect(parseAgentRequest({ op: 'approval.status', id: ' a1 ' })).toEqual({
      ok: true,
      request: { op: 'approval.status', id: 'a1' },
    });
    expect(parseAgentRequest({ op: 'approval.status' })).toEqual({ ok: false, message: 'approval.status needs a id.' });
  });

  it('takes the approval list op, and the reject op with the id it names', () => {
    expect(parseAgentRequest({ op: 'approvals.list' })).toEqual({ ok: true, request: { op: 'approvals.list' } });
    expect(parseAgentRequest({ op: 'approval.reject', id: ' a1 ' })).toEqual({
      ok: true,
      request: { op: 'approval.reject', id: 'a1' },
    });
    expect(parseAgentRequest({ op: 'approval.reject' })).toEqual({ ok: false, message: 'approval.reject needs a id.' });
  });

  it('takes the auto mode ask with the day and the one subject it names', () => {
    expect(parseAgentRequest({ op: 'autoMode.ask', day: '2026-10-05', standInId: ' s1 ' })).toEqual({
      ok: true,
      request: { op: 'autoMode.ask', day: '2026-10-05', subject: { kind: 'stand-in', standInId: 's1' } },
    });
    expect(parseAgentRequest({ op: 'autoMode.ask', day: '2026-10-05', contextId: 'repo:/a' })).toEqual({
      ok: true,
      request: { op: 'autoMode.ask', day: '2026-10-05', subject: { kind: 'context', contextId: 'repo:/a' } },
    });
    expect(parseAgentRequest({ op: 'autoMode.ask', day: '2026-10-05' })).toEqual({
      ok: false,
      message: 'autoMode.ask needs a standInId or contextId.',
    });
    expect(parseAgentRequest({ op: 'autoMode.ask', day: '2026-10-05', standInId: 's1', contextId: 'c' })).toEqual({
      ok: false,
      message: 'autoMode.ask asks about a standInId or a contextId, not both.',
    });
    expect(parseAgentRequest({ op: 'autoMode.ask', standInId: 's1' })).toEqual({
      ok: false,
      message: 'autoMode.ask needs a day as YYYY-MM-DD.',
    });
  });

  it('takes the agent session resync op with its checkouts', () => {
    expect(parseAgentRequest({ op: 'agentSessions.resync', paths: [' /home/a ', '', 3] })).toEqual({
      ok: true,
      request: { op: 'agentSessions.resync', paths: ['/home/a'] },
    });
  });

  it('reads a replacing agent session resync only from a literal true', () => {
    expect(parseAgentRequest({ op: 'agentSessions.resync', paths: ['/home/a'], replace: true })).toEqual({
      ok: true,
      request: { op: 'agentSessions.resync', paths: ['/home/a'], replace: true },
    });
    expect(parseAgentRequest({ op: 'agentSessions.resync', paths: ['/home/a'], replace: 'yes' })).toEqual({
      ok: true,
      request: { op: 'agentSessions.resync', paths: ['/home/a'] },
    });
  });

  it('refuses an agent session resync that names no checkout', () => {
    expect(parseAgentRequest({ op: 'agentSessions.resync', paths: [] })).toEqual({
      ok: false,
      message: 'agentSessions.resync needs a paths.',
    });
  });

  it('refuses a stand-in delete that names no id', () => {
    expect(parseAgentRequest({ op: 'standIn.remove' })).toEqual({
      ok: false,
      message: 'standIn.remove needs a id.',
    });
  });

  it('takes the stand-in rename op', () => {
    expect(parseAgentRequest({ op: 'standIn.rename', id: 'stand-in:1:repo', name: 'Journey' })).toEqual({
      ok: true,
      request: { op: 'standIn.rename', id: 'stand-in:1:repo', name: 'Journey' },
    });
  });

  it('refuses a stand-in rename that names no new name', () => {
    expect(parseAgentRequest({ op: 'standIn.rename', id: 'stand-in:1:repo' })).toEqual({
      ok: false,
      message: 'standIn.rename needs a name.',
    });
  });

  it('reads a stand-in merge, and refuses one without the stand-in it goes into', () => {
    expect(parseAgentRequest({ op: 'standIn.merge', id: 'stand-in:2', into: 'stand-in:1' })).toEqual({
      ok: true,
      request: { op: 'standIn.merge', id: 'stand-in:2', into: 'stand-in:1' },
    });
    expect(parseAgentRequest({ op: 'standIn.merge', id: 'stand-in:2' })).toEqual({
      ok: false,
      message: 'standIn.merge needs a into.',
    });
  });

  it('takes the stand-in split op, and drops a commit that names no day or no file', () => {
    expect(
      parseAgentRequest({
        op: 'standIn.split',
        id: 'stand-in:1:repo',
        branch: 'main',
        apply: true,
        commits: [
          { day: '2026-09-08', paths: ['src/a/one.ts'] },
          { day: 'yesterday', paths: ['src/b/two.ts'] },
          { day: '2026-09-09', paths: [] },
        ],
      }),
    ).toEqual({
      ok: true,
      request: {
        op: 'standIn.split',
        id: 'stand-in:1:repo',
        branch: 'main',
        apply: true,
        paths: [],
        projectRoots: [],
        commits: [{ day: '2026-09-08', paths: ['src/a/one.ts'] }],
      },
    });
  });

  it('takes the projects a split cuts its pieces to', () => {
    expect(
      parseAgentRequest({
        op: 'standIn.split',
        id: 'x',
        branch: 'main',
        commits: [{ day: '2026-09-08', paths: ['libs/one/src/a.ts'] }],
        projectRoots: ['libs/one', 'libs/two', ''],
      }),
    ).toMatchObject({ ok: true, request: { projectRoots: ['libs/one', 'libs/two'] } });
  });

  it('reads a split without apply as a plan, and refuses one with no commit left', () => {
    expect(
      parseAgentRequest({
        op: 'standIn.split',
        id: 'x',
        branch: 'main',
        commits: [{ day: '2026-09-08', paths: ['a.ts'] }],
      }),
    ).toMatchObject({ ok: true, request: { apply: false } });

    expect(parseAgentRequest({ op: 'standIn.split', id: 'x', branch: 'main', commits: [] })).toEqual({
      ok: false,
      message: 'standIn.split needs a commits.',
    });
  });

  it('says what it does not know', () => {
    expect(parseAgentRequest({ op: 'jira.delete' })).toEqual({
      ok: false,
      message: 'Timetrack has no operation named jira.delete.',
    });

    expect(parseAgentRequest({})).toEqual({ ok: false, message: 'The request names no operation.' });
  });
});

describe('parseAgentRequest, over a day', () => {
  it('reads a day key', () => {
    expect(parseAgentRequest({ op: 'day.events', day: '2026-09-10' })).toEqual({
      ok: true,
      request: { op: 'day.events', day: '2026-09-10' },
    });
  });

  it('refuses anything that is not a day key', () => {
    expect(parseAgentRequest({ op: 'day.events', day: 'yesterday' })).toEqual({
      ok: false,
      message: 'day.events needs a day as YYYY-MM-DD.',
    });
  });

  it('holds the naming op to the same day key', () => {
    expect(parseAgentRequest({ op: 'naming.offers', day: '2026-09-14' })).toEqual({
      ok: true,
      request: { op: 'naming.offers', day: '2026-09-14' },
    });

    expect(parseAgentRequest({ op: 'naming.offers' })).toEqual({
      ok: false,
      message: 'naming.offers needs a day as YYYY-MM-DD.',
    });
  });

  it.each(['day.events', 'day.rows', 'day.inputs', 'naming.offers', 'tempo.sync'])(
    'refuses a %s day key that names no calendar day',
    (op) => {
      for (const day of ['2026-02-30', '2026-13-01', '2026-00-10']) {
        expect(parseAgentRequest({ op, day })).toEqual({
          ok: false,
          message: `${op} needs a day as YYYY-MM-DD.`,
        });
      }
    },
  );

  it('refuses a day.edits day key that names no calendar day', () => {
    expect(
      parseAgentRequest({ op: 'day.edits', day: '2026-02-30', edits: [{ kind: 'reset', rowId: 'row-1' }] }),
    ).toEqual({ ok: false, message: 'day.edits needs a day as YYYY-MM-DD.' });
  });

  it('refuses a split commit whose day names no calendar day', () => {
    expect(
      parseAgentRequest({
        op: 'standIn.split',
        id: 'stand-in-1',
        branch: 'main',
        commits: [{ day: '2026-02-30', paths: ['a.ts'] }],
      }),
    ).toEqual({ ok: false, message: 'standIn.split needs a commits.' });
  });
});

describe('parseAgentRequest, over a day edit', () => {
  it('reads a row edit of every kind it makes', () => {
    const edits = [
      { kind: 'range', rowId: 'a', fromMs: 10, toMs: 20 },
      { kind: 'issue', rowId: 'b', issueKey: 'abc-1' },
      { kind: 'description', rowId: 'c', description: ' a note ' },
      { kind: 'state', rowId: 'd', state: 'rejected' },
      { kind: 'hidden', rowId: 'e', hidden: true },
      { kind: 'reset', rowId: 'f' },
    ];

    expect(parseAgentRequest({ op: 'day.edits', day: '2026-09-14', edits })).toEqual({
      ok: true,
      request: {
        op: 'day.edits',
        day: '2026-09-14',
        edits: [
          { kind: 'range', rowId: 'a', fromMs: 10, toMs: 20 },
          { kind: 'issue', rowId: 'b', issueKey: 'ABC-1' },
          { kind: 'description', rowId: 'c', description: 'a note' },
          { kind: 'state', rowId: 'd', state: 'rejected' },
          { kind: 'hidden', rowId: 'e', hidden: true },
          { kind: 'reset', rowId: 'f' },
        ],
      },
    });
  });

  it('drops an entry it cannot read, and keeps the ones beside it', () => {
    const edits = [
      { kind: 'range', rowId: 'a', fromMs: 20, toMs: 10 },
      { kind: 'nudge', rowId: 'b' },
      { kind: 'issue', rowId: '', issueKey: 'ABC-1' },
      { kind: 'state', rowId: 'd', state: 'maybe' },
      { kind: 'reset', rowId: 'f' },
    ];
    const parsed = parseAgentRequest({ op: 'day.edits', day: '2026-09-14', edits });

    expect(parsed).toEqual({
      ok: true,
      request: { op: 'day.edits', day: '2026-09-14', edits: [{ kind: 'reset', rowId: 'f' }] },
    });
  });

  it('refuses a write with nothing in it that it makes', () => {
    expect(parseAgentRequest({ op: 'day.edits', day: '2026-09-14', edits: [{ kind: 'nudge', rowId: 'b' }] })).toEqual({
      ok: false,
      message: 'day.edits was given no edit this endpoint makes.',
    });

    expect(parseAgentRequest({ op: 'day.edits', day: '2026-09-14' })).toEqual({
      ok: false,
      message: 'day.edits needs a list of edits.',
    });
  });

  it('holds the row read to the same day key', () => {
    expect(parseAgentRequest({ op: 'day.rows', day: '2026-09-14' })).toEqual({
      ok: true,
      request: { op: 'day.rows', day: '2026-09-14' },
    });

    expect(parseAgentRequest({ op: 'day.rows', day: 'today' })).toEqual({
      ok: false,
      message: 'day.rows needs a day as YYYY-MM-DD.',
    });
  });

  it('holds the review inputs read to the same day key', () => {
    expect(parseAgentRequest({ op: 'day.inputs', day: '2026-09-14' })).toEqual({
      ok: true,
      request: { op: 'day.inputs', day: '2026-09-14' },
    });
  });

  it('reads a Tempo worklog range with both ends included', () => {
    expect(parseAgentRequest({ op: 'tempo.worklogs', from: ' 2026-06-25 ', to: '2026-09-24' })).toEqual({
      ok: true,
      request: { op: 'tempo.worklogs', from: '2026-06-25', to: '2026-09-24' },
    });
  });

  it('reads a Tempo sync of one day, with the plan hash a write names', () => {
    expect(parseAgentRequest({ op: 'tempo.sync', day: '2026-09-07' })).toEqual({
      ok: true,
      request: { op: 'tempo.sync', day: '2026-09-07' },
    });
    expect(parseAgentRequest({ op: 'tempo.sync', day: '2026-09-07', planHash: ' 1a2b3c4d ' })).toEqual({
      ok: true,
      request: { op: 'tempo.sync', day: '2026-09-07', planHash: '1a2b3c4d' },
    });
    expect(parseAgentRequest({ op: 'tempo.sync', day: 'today' })).toEqual({
      ok: false,
      message: 'tempo.sync needs a day as YYYY-MM-DD.',
    });
  });

  it('reads a Tempo delete of one worklog on one day', () => {
    expect(parseAgentRequest({ op: 'tempo.delete', day: ' 2026-09-07 ', worklogId: ' 98765 ' })).toEqual({
      ok: true,
      request: { op: 'tempo.delete', day: '2026-09-07', worklogId: '98765' },
    });
  });

  it('refuses a Tempo delete without a calendar day or a numeric worklog id', () => {
    expect(parseAgentRequest({ op: 'tempo.delete', day: '2026-02-30', worklogId: '98765' })).toEqual({
      ok: false,
      message: 'tempo.delete needs a day as YYYY-MM-DD.',
    });
    expect(parseAgentRequest({ op: 'tempo.delete', worklogId: '98765' })).toEqual({
      ok: false,
      message: 'tempo.delete needs a day as YYYY-MM-DD.',
    });
    expect(parseAgentRequest({ op: 'tempo.delete', day: '2026-09-07' })).toEqual({
      ok: false,
      message: 'tempo.delete needs a numeric worklogId.',
    });
    expect(parseAgentRequest({ op: 'tempo.delete', day: '2026-09-07', worklogId: '98765; DROP' })).toEqual({
      ok: false,
      message: 'tempo.delete needs a numeric worklogId.',
    });
  });

  it('refuses a Tempo range one day wider than the cap', () => {
    expect(parseAgentRequest({ op: 'tempo.worklogs', from: '2026-06-24', to: '2026-09-24' })).toEqual({
      ok: false,
      message: 'tempo.worklogs reads at most 92 days at once.',
    });
  });

  it('refuses a Tempo range that runs backwards', () => {
    expect(parseAgentRequest({ op: 'tempo.worklogs', from: '2026-09-02', to: '2026-09-01' })).toEqual({
      ok: false,
      message: 'tempo.worklogs needs from on or before to, not 2026-09-02 after 2026-09-01.',
    });
  });

  it('refuses a Tempo range end that names no calendar day', () => {
    expect(parseAgentRequest({ op: 'tempo.worklogs', from: '2026-02-01', to: '2026-02-30' })).toEqual({
      ok: false,
      message: 'tempo.worklogs needs a to as YYYY-MM-DD.',
    });
    expect(parseAgentRequest({ op: 'tempo.worklogs', to: '2026-02-03' })).toEqual({
      ok: false,
      message: 'tempo.worklogs needs a from as YYYY-MM-DD.',
    });
  });

  it('reads a calendar range under the same cap as a Tempo range', () => {
    expect(parseAgentRequest({ op: 'calendar.events', from: '2026-09-01', to: '2026-09-24' })).toEqual({
      ok: true,
      request: { op: 'calendar.events', from: '2026-09-01', to: '2026-09-24' },
    });
    expect(parseAgentRequest({ op: 'calendar.events', from: '2026-06-24', to: '2026-09-24' })).toEqual({
      ok: false,
      message: 'calendar.events reads at most 92 days at once.',
    });
    expect(parseAgentRequest({ op: 'calendar.events', from: '2026-09-02', to: '2026-09-01' })).toEqual({
      ok: false,
      message: 'calendar.events needs from on or before to, not 2026-09-02 after 2026-09-01.',
    });
  });
});
