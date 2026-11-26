import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import {
  JIRA_MIRROR_FULL_READ_MS,
  JiraMirror,
  JiraMirrorIssue,
  mergeJiraMirror,
  parseJiraMirror,
  syncJiraMirror$,
} from './mirror';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const NOW = Date.parse('2026-10-09T12:00:00.000Z');
const DAY = 24 * 60 * 60_000;

const issue = (key: string, extra: Partial<JiraMirrorIssue> = {}): JiraMirrorIssue => ({
  key,
  id: key,
  summary: `Summary of ${key}`,
  issueType: 'Story',
  done: false,
  updatedMs: NOW - DAY,
  ...extra,
});

const resource = (key: string, extra: { category?: string; updated?: string; parent?: string } = {}) => ({
  id: key,
  key,
  fields: {
    summary: `Read ${key}`,
    issuetype: { name: 'Story', subtask: false },
    status: { statusCategory: { key: extra.category ?? 'indeterminate' } },
    updated: extra.updated ?? '2026-10-09T11:00:00.000+0200',
    ...(extra.parent ? { parent: { key: extra.parent, fields: { summary: 'Rewards' } } } : {}),
  },
});

const searchTransport = (answer: () => unknown) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: answer() }) as never;
    }),
  };

  return { transport, requests };
};

const jqlOf = (request: TimetrackRequest | undefined) => new URL(request?.url ?? 'https://x').searchParams.get('jql');

describe('syncJiraMirror$', () => {
  it('reads a project with no mirror whole: open issues and those closed in the last 30 days', () => {
    const { transport, requests } = searchTransport(() => ({
      issues: [resource('ABC-1', { parent: 'ABC-9' }), resource('ABC-2', { category: 'done' })],
    }));
    const seen = vi.fn();

    syncJiraMirror$({ transport, credentials: CREDENTIALS, projectKey: 'ABC', held: null, nowMs: NOW }).subscribe(seen);

    expect(jqlOf(requests[0])).toBe(
      'project = "ABC" AND (statusCategory != Done OR updated >= -30d) ORDER BY updated DESC',
    );
    expect(new URL(requests[0]?.url ?? '').searchParams.get('fields')).toBe('summary,issuetype,parent,status,updated');

    const mirror = seen.mock.calls[0]?.[0] as JiraMirror;

    expect(mirror).toMatchObject({ projectKey: 'ABC', fullAtMs: NOW, syncedAtMs: NOW });
    expect(mirror.issues).toEqual([
      expect.objectContaining({ key: 'ABC-1', parentKey: 'ABC-9', parentSummary: 'Rewards', done: false }),
      expect.objectContaining({ key: 'ABC-2', done: true, updatedMs: Date.parse('2026-10-09T09:00:00.000Z') }),
    ]);
  });

  it('reads only what changed since the last read, with five minutes of overlap', () => {
    const held: JiraMirror = {
      projectKey: 'ABC',
      fullAtMs: NOW - 60 * 60_000,
      syncedAtMs: NOW - 20 * 60_000,
      issues: [],
    };
    const { transport, requests } = searchTransport(() => ({ issues: [] }));

    syncJiraMirror$({ transport, credentials: CREDENTIALS, projectKey: 'ABC', held, nowMs: NOW }).subscribe();

    expect(jqlOf(requests[0])).toBe('project = "ABC" AND updated >= -25m ORDER BY updated DESC');
  });

  it('reads the project whole again once a day', () => {
    const held: JiraMirror = {
      projectKey: 'ABC',
      fullAtMs: NOW - JIRA_MIRROR_FULL_READ_MS,
      syncedAtMs: NOW - 60_000,
      issues: [issue('ABC-5')],
    };
    const { transport, requests } = searchTransport(() => ({ issues: [resource('ABC-1')] }));
    const seen = vi.fn();

    syncJiraMirror$({ transport, credentials: CREDENTIALS, projectKey: 'ABC', held, nowMs: NOW }).subscribe(seen);

    expect(jqlOf(requests[0])).toContain('statusCategory != Done OR updated >= -30d');
    expect((seen.mock.calls[0]?.[0] as JiraMirror).issues.map((entry) => entry.key)).toEqual(['ABC-1']);
  });

  it('pages a project larger than one page', () => {
    let page = 0;
    const { transport, requests } = searchTransport(() =>
      ++page === 1 ? { issues: [resource('ABC-1')], nextPageToken: 'next' } : { issues: [resource('ABC-2')] },
    );
    const seen = vi.fn();

    syncJiraMirror$({ transport, credentials: CREDENTIALS, projectKey: 'ABC', held: null, nowMs: NOW }).subscribe(seen);

    expect(requests).toHaveLength(2);
    expect((seen.mock.calls[0]?.[0] as JiraMirror).issues).toHaveLength(2);
  });

  it('errors on a failed read, so the caller keeps the mirror it holds', () => {
    const transport: TimetrackTransport = {
      request$: vi.fn(() => of({ status: 429, headers: {}, body: {} })) as never,
    };
    const failed = vi.fn();

    syncJiraMirror$({ transport, credentials: CREDENTIALS, projectKey: 'ABC', held: null, nowMs: NOW }).subscribe({
      error: failed,
    });

    expect(failed).toHaveBeenCalled();
  });
});

describe('mergeJiraMirror', () => {
  const held: JiraMirror = {
    projectKey: 'ABC',
    fullAtMs: NOW - DAY / 2,
    syncedAtMs: NOW - 60 * 60_000,
    issues: [issue('ABC-1', { summary: 'Old wording' }), issue('ABC-2')],
  };

  it('lays the changed issues over the held ones, by id or key', () => {
    const merged = mergeJiraMirror({
      held,
      read: [issue('ABC-1', { summary: 'New wording', updatedMs: NOW })],
      projectKey: 'ABC',
      nowMs: NOW,
      full: false,
    });

    expect(merged.issues.map((entry) => [entry.key, entry.summary])).toEqual([
      ['ABC-1', 'New wording'],
      ['ABC-2', 'Summary of ABC-2'],
    ]);
    expect(merged).toMatchObject({ fullAtMs: held.fullAtMs, syncedAtMs: NOW });
  });

  it('drops a done issue older than 30 days and an issue of another project', () => {
    const merged = mergeJiraMirror({
      held,
      read: [issue('ABC-3', { done: true, updatedMs: NOW - 31 * DAY }), issue('XYZ-1'), issue('ABC-4', { done: true })],
      projectKey: 'abc',
      nowMs: NOW,
      full: false,
    });

    expect(merged.issues.map((entry) => entry.key).sort()).toEqual(['ABC-1', 'ABC-2', 'ABC-4']);
  });
});

describe('parseJiraMirror', () => {
  it('reads back what was stored and refuses a document that is not a mirror', () => {
    const mirror: JiraMirror = {
      projectKey: 'ABC',
      fullAtMs: 1,
      syncedAtMs: 2,
      issues: [issue('ABC-1', { parentKey: 'ABC-9', parentSummary: 'Rewards', isSubtask: true })],
    };

    expect(parseJiraMirror(JSON.parse(JSON.stringify(mirror)))).toEqual(mirror);
    expect(parseJiraMirror({ projectKey: 'ABC' })).toBeNull();
    expect(parseJiraMirror(null)).toBeNull();
  });
});
