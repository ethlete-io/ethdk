import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraIssueChildren, fetchJiraIssueChildren$ } from './children';
import { JiraCredentials } from './client';

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

const jqlOf = (request: TimetrackRequest | undefined) =>
  decodeURIComponent(new URL(request?.url ?? 'https://x').searchParams.get('jql') ?? '');

const childrenOf = (options: { issues: unknown[]; parentKeys: string[]; limit?: number }) => {
  const { transport, requests } = fakeTransport(options.issues);
  let result: JiraIssueChildren[] = [];

  fetchJiraIssueChildren$({
    transport,
    credentials: CREDENTIALS,
    parentKeys: options.parentKeys,
    limit: options.limit,
  }).subscribe((value) => (result = value));

  return { result, requests };
};

const issues = (count: number, from = 1) =>
  Array.from({ length: count }, (_, index) => ({ key: `ABC-${from + index}` }));

describe('fetchJiraIssueChildren$', () => {
  it('asks for the open children of one parent', () => {
    const { requests } = childrenOf({ issues: [], parentKeys: ['ABC-12605'] });

    expect(jqlOf(requests[0])).toBe('parent = "ABC-12605" AND statusCategory != Done ORDER BY created ASC');
  });

  it('reads each parent on its own, so the cap can be reported per parent', () => {
    const { requests } = childrenOf({ issues: [], parentKeys: ['ABC-1', 'ABC-2'] });

    expect(requests).toHaveLength(2);
  });

  it('asks for the same key once', () => {
    const { requests } = childrenOf({ issues: [], parentKeys: ['ABC-1', 'ABC-1'] });

    expect(requests).toHaveLength(1);
  });

  it('makes no call at all when no parent is named', () => {
    const { requests, result } = childrenOf({ issues: [], parentKeys: [] });

    expect(requests).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('returns the child keys with the cap untouched', () => {
    const { result } = childrenOf({ issues: issues(2), parentKeys: ['ABC-12605'], limit: 5 });

    expect(result[0]).toEqual({ parentKey: 'ABC-12605', childKeys: ['ABC-1', 'ABC-2'], truncated: false });
  });

  it('marks the list truncated when more children came back than the cap holds', () => {
    const { result } = childrenOf({ issues: issues(4), parentKeys: ['ABC-12605'], limit: 3 });

    expect(result[0]?.childKeys).toEqual(['ABC-1', 'ABC-2', 'ABC-3']);
    expect(result[0]?.truncated).toBe(true);
  });

  it('does not call a list that exactly fills the cap truncated', () => {
    const { result } = childrenOf({ issues: issues(3), parentKeys: ['ABC-12605'], limit: 3 });

    expect(result[0]?.truncated).toBe(false);
  });

  it('holds a cap below two up to the smallest one that can say anything', () => {
    const { result } = childrenOf({ issues: issues(3), parentKeys: ['ABC-12605'], limit: 0 });

    expect(result[0]?.childKeys).toHaveLength(2);
    expect(result[0]?.truncated).toBe(true);
  });
});
