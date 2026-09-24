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

  it('takes the agent session resync op with its checkouts', () => {
    expect(parseAgentRequest({ op: 'agentSessions.resync', paths: [' /home/a ', '', 3] })).toEqual({
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
});
