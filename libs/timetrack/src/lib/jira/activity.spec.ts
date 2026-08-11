import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssueResource } from './search';
import { fetchJiraIssueActivity$ } from './activity';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const activityTransport = (issues: JiraIssueResource[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { issues } }) as never;
    }),
  };

  return { transport, requests };
};

const activity$ = (transport: TimetrackTransport) =>
  fetchJiraIssueActivity$({
    transport,
    credentials: CREDENTIALS,
    from: new Date(2026, 7, 11, 8, 0),
    to: new Date(2026, 7, 11, 18, 30),
  });

describe('fetchJiraIssueActivity$', () => {
  it('asks for what the user themselves changed, in jira date syntax', () => {
    const { transport, requests } = activityTransport([]);

    activity$(transport).subscribe();

    const jql = decodeURIComponent(/jql=([^&]*)/.exec(requests[0]?.url ?? '')?.[1] ?? '');

    expect(jql).toContain('updatedBy(currentUser(), "2026/08/11 08:00", "2026/08/11 18:30")');
  });

  it('turns each changed issue into ladder-ready activity at the moment it changed', () => {
    const { transport } = activityTransport([
      { key: 'FIP-3010', fields: { summary: 'Logout', updated: '2026-08-11T10:42:00.000+0200' } },
    ]);
    const seen = vi.fn();

    activity$(transport).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      {
        kind: 'issue-view',
        issueKey: 'FIP-3010',
        at: new Date('2026-08-11T10:42:00.000+0200'),
        detail: 'you changed FIP-3010 in Jira',
      },
    ]);
  });

  it('drops an issue with no usable update timestamp rather than placing it at the epoch', () => {
    const { transport } = activityTransport([
      { key: 'FIP-1', fields: { summary: 'a' } },
      { key: 'FIP-2', fields: { summary: 'b', updated: 'not a date' } },
      { key: 'FIP-3', fields: { summary: 'c', updated: '2026-08-11T10:00:00.000+0200' } },
    ]);
    const seen = vi.fn();

    activity$(transport).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].map((entry: { issueKey: string }) => entry.issueKey)).toEqual(['FIP-3']);
  });
});
