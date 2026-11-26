import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import {
  fetchJiraIssueState$,
  fetchJiraIssueStatus$,
  fetchJiraStatuses$,
  fetchJiraTransitions$,
  moveJiraIssueTo$,
} from './status';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const fakeTransport = (bodies: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: bodies[requests.length - 1] ?? {} }) as never;
    }),
  };

  return { transport, requests };
};

const TRANSITIONS = {
  transitions: [
    { id: '11', name: 'Start', to: { name: 'In Progress' } },
    { id: '31', name: 'Finish', to: { name: 'Done' } },
  ],
};

describe('fetchJiraStatuses$', () => {
  it('folds a name that several workflows define onto one entry', () => {
    const { transport } = fakeTransport([
      [
        { id: '3', name: 'In Progress' },
        { id: '10001', name: 'In Progress' },
        { id: '1', name: 'Backlog' },
      ],
    ]);
    const seen = vi.fn();

    fetchJiraStatuses$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen).toHaveBeenCalledWith([
      { id: '1', name: 'Backlog' },
      { id: '3', name: 'In Progress' },
    ]);
  });

  it('leaves out an entry the instance named nothing', () => {
    const { transport } = fakeTransport([[{ id: '3' }, { name: 'Backlog' }]]);
    const seen = vi.fn();

    fetchJiraStatuses$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen).toHaveBeenCalledWith([]);
  });
});

describe('fetchJiraIssueStatus$', () => {
  it('reads only the status field of the issue', () => {
    const { transport, requests } = fakeTransport([
      { key: 'FIP-9', fields: { status: { id: '3', name: 'In Progress' } } },
    ]);
    const seen = vi.fn();

    fetchJiraIssueStatus$({ transport, credentials: CREDENTIALS, issueKey: 'FIP-9' }).subscribe(seen);

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issue/FIP-9?fields=status');
    expect(seen).toHaveBeenCalledWith('In Progress');
  });

  it('answers an empty name for an issue Jira returned no status for', () => {
    const { transport } = fakeTransport([{ key: 'FIP-9', fields: {} }]);
    const seen = vi.fn();

    fetchJiraIssueStatus$({ transport, credentials: CREDENTIALS, issueKey: 'FIP-9' }).subscribe(seen);

    expect(seen).toHaveBeenCalledWith('');
  });
});

describe('fetchJiraIssueState$', () => {
  const stateOf = (answer: { status: number; body: unknown }) => {
    const transport: TimetrackTransport = { request$: vi.fn(() => of({ headers: {}, ...answer })) as never };
    const seen = vi.fn();
    const failed = vi.fn();

    fetchJiraIssueState$({ transport, credentials: CREDENTIALS, issueKey: 'fip-9' }).subscribe({
      next: seen,
      error: failed,
    });

    return { seen, failed };
  };

  it('reads an issue in the done category as done, and any other as open', () => {
    expect(
      stateOf({ status: 200, body: { key: 'FIP-9', fields: { status: { statusCategory: { key: 'done' } } } } }).seen,
    ).toHaveBeenCalledWith('done');
    expect(
      stateOf({ status: 200, body: { key: 'FIP-9', fields: { status: { statusCategory: { key: 'new' } } } } }).seen,
    ).toHaveBeenCalledWith('open');
  });

  it('reads a deleted issue and one Jira answers under another key as gone', () => {
    expect(stateOf({ status: 404, body: { errorMessages: ['Issue does not exist.'] } }).seen).toHaveBeenCalledWith(
      'gone',
    );
    expect(stateOf({ status: 200, body: { key: 'OTHER-4', fields: {} } }).seen).toHaveBeenCalledWith('gone');
  });

  it('fails on any other refusal rather than guessing', () => {
    const { seen, failed } = stateOf({ status: 429, body: {} });

    expect(seen).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalled();
  });
});

describe('fetchJiraTransitions$', () => {
  it('reads the moves the issue offers, each with the status it lands in', () => {
    const { transport, requests } = fakeTransport([TRANSITIONS]);
    const seen = vi.fn();

    fetchJiraTransitions$({ transport, credentials: CREDENTIALS, issueKey: 'FIP-9' }).subscribe(seen);

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issue/FIP-9/transitions');
    expect(seen).toHaveBeenCalledWith([
      { id: '11', name: 'Start', toStatusName: 'In Progress' },
      { id: '31', name: 'Finish', toStatusName: 'Done' },
    ]);
  });
});

describe('moveJiraIssueTo$', () => {
  it('posts the move that lands in the named status', () => {
    const { transport, requests } = fakeTransport([TRANSITIONS, {}]);
    const seen = vi.fn();

    moveJiraIssueTo$({
      transport,
      credentials: CREDENTIALS,
      issueKey: 'FIP-9',
      statusName: 'In Progress',
    }).subscribe(seen);

    expect(requests[1]?.method).toBe('POST');
    expect(requests[1]?.body).toEqual({ transition: { id: '11' } });
    expect(seen).toHaveBeenCalledWith({ kind: 'moved', statusName: 'In Progress' });
  });

  it('matches the status however it is cased, because a setting is typed by hand', () => {
    const { transport, requests } = fakeTransport([TRANSITIONS, {}]);

    moveJiraIssueTo$({ transport, credentials: CREDENTIALS, issueKey: 'FIP-9', statusName: 'in progress' }).subscribe();

    expect(requests[1]?.body).toEqual({ transition: { id: '11' } });
  });

  it('names what the workflow offers instead, rather than failing, when nothing leads there', () => {
    const { transport, requests } = fakeTransport([TRANSITIONS]);
    const seen = vi.fn();

    moveJiraIssueTo$({ transport, credentials: CREDENTIALS, issueKey: 'FIP-9', statusName: 'Review' }).subscribe(seen);

    expect(requests).toHaveLength(1);
    expect(seen).toHaveBeenCalledWith({ kind: 'unavailable', statusName: 'Review', offered: ['In Progress', 'Done'] });
  });
});
