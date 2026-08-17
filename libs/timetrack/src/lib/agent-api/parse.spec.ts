import { describe, expect, it } from 'vitest';
import { parseAgentRequest } from './parse';

describe('parseAgentRequest', () => {
  it('reads an issue lookup and uppercases the key', () => {
    expect(parseAgentRequest({ op: 'jira.issue', key: ' fip-2177 ' })).toEqual({
      ok: true,
      request: { op: 'jira.issue', key: 'FIP-2177' },
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

  it('says what it does not know', () => {
    expect(parseAgentRequest({ op: 'jira.delete' })).toEqual({
      ok: false,
      message: 'Timetrack has no operation named jira.delete.',
    });

    expect(parseAgentRequest({})).toEqual({ ok: false, message: 'The request names no operation.' });
  });
});
