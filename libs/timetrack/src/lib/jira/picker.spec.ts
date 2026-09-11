import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraIssuePickerFilter, fetchJiraIssuePicks$ } from './picker';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const fakeTransport = (issues: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { issues } }) as never;
    }),
  };

  return { transport, requests };
};

const queryOf = (request: TimetrackRequest | undefined, key: string) =>
  decodeURIComponent(new URL(request?.url ?? 'https://x').searchParams.get(key) ?? '');

const pick = (filter?: JiraIssuePickerFilter, issues: unknown[] = []) => {
  const { transport, requests } = fakeTransport(issues);
  const found: unknown[] = [];

  fetchJiraIssuePicks$({ transport, credentials: CREDENTIALS, filter }).subscribe((issue) => found.push(issue));

  return { jql: queryOf(requests[0], 'jql'), requests, found };
};

describe('fetchJiraIssuePicks$', () => {
  it('reads the open issues of the projects it was given, most recent first', () => {
    expect(pick({ projectKeys: ['ABC', 'DEF'] }).jql).toBe(
      'project in ("ABC", "DEF") AND statusCategory != Done ORDER BY updated DESC',
    );
  });

  it('narrows to the account itself when asked', () => {
    expect(pick({ projectKeys: ['ABC'], assignedToMe: true }).jql).toBe(
      'project in ("ABC") AND statusCategory != Done AND assignee = currentUser() ORDER BY updated DESC',
    );
  });

  it('matches typed text against the wording, as a prefix', () => {
    expect(pick({ projectKeys: ['ABC'], text: ' club pack ' }).jql).toBe(
      'project in ("ABC") AND statusCategory != Done AND text ~ "club pack*" ORDER BY updated DESC',
    );
  });

  it('escapes a quote in typed text rather than letting it end the literal', () => {
    expect(pick({ text: 'a "b' }).jql).toBe('statusCategory != Done AND text ~ "a \\"b*" ORDER BY updated DESC');
  });

  it('includes done issues only when asked, and reads every project when none is named', () => {
    expect(pick({ includeDone: true }).jql).toBe('ORDER BY updated DESC');
    expect(pick({}).jql).toBe('statusCategory != Done ORDER BY updated DESC');
  });

  it('reads one page, of the size it was given', () => {
    const { requests } = pick({ limit: 25 });

    expect(queryOf(requests[0], 'maxResults')).toBe('25');
    expect(requests).toHaveLength(1);
  });

  it('reads a typed key as that one key, because `text ~` never matches a key', () => {
    expect(pick({ projectKeys: ['ABC'], text: ' et-772 ' }).jql).toBe('key in (ET-772)');
  });

  it('reads a typed key outside every other clause, so a closed issue is still reachable', () => {
    const { jql } = pick({ projectKeys: ['ABC'], text: 'XYZ-1' });

    expect(jql).not.toContain('statusCategory');
    expect(jql).not.toContain('project in');
  });

  it('searches the wording for text that is not yet a whole key', () => {
    expect(pick({ text: 'ET-' }).jql).toBe('statusCategory != Done AND text ~ "ET-*" ORDER BY updated DESC');
  });

  it('drops an issue Jira answered without a key or an id', () => {
    const { found } = pick({}, [
      { id: '1', key: 'ABC-1', fields: { summary: 'Alpha', issuetype: { name: 'Task' } } },
      { key: 'ABC-2' },
    ]);

    expect(found).toEqual([
      [{ key: 'ABC-1', id: '1', summary: 'Alpha', issueType: 'Task', parentKey: undefined, subject: undefined }],
    ]);
  });
});
