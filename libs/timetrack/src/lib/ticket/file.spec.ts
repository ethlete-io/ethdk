import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from '../jira/client';
import { JiraIssueInput } from '../jira/create';
import { fileTicketOnce$ } from './file';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const INPUT: JiraIssueInput = {
  projectKey: 'FIP',
  issueTypeName: 'Task',
  summary: 'User management screen',
  description: 'From 17 commits.',
};

const resource = (key: string, summary: string) => ({
  id: key,
  key,
  fields: { summary, issuetype: { name: 'Task' } },
});

/**
 * A Jira that takes every create and holds what it was given, and that answers a create with nothing.
 *
 * That is the case a duplicate costs: the issue exists and the caller cannot know it. A test that
 * lets the answer through would pass with no guard at all.
 */
const fakeJira = (options: { dropCreateAnswer?: boolean } = {}) => {
  const held: { key: string; summary: string }[] = [];
  const requests: TimetrackRequest[] = [];
  let next = 9;

  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.method === 'POST' && request.url.endsWith('/issue')) {
        const fields = (request.body as { fields: { summary: string } }).fields;
        const key = `FIP-${next++}`;

        held.push({ key, summary: fields.summary });

        return of({
          status: 201,
          headers: {},
          body: options.dropCreateAnswer ? {} : { id: key, key },
        }) as never;
      }

      return of({
        status: 200,
        headers: {},
        body: { issues: held.map((issue) => resource(issue.key, issue.summary)) },
      }) as never;
    }),
  };

  return { transport, held, requests };
};

const press = (jira: { transport: TimetrackTransport }) => {
  let answered: { issueKey: string; duplicate: boolean } | undefined;
  let failed: unknown;

  fileTicketOnce$({ transport: jira.transport, credentials: CREDENTIALS, input: INPUT }).subscribe({
    next: (filed) => (answered = filed),
    error: (error: unknown) => (failed = error),
  });

  return { answered, failed };
};

describe('fileTicketOnce$', () => {
  it('files the ticket when the project holds nothing like it', () => {
    const jira = fakeJira();

    expect(press(jira).answered).toEqual({ issueKey: 'FIP-9', issueId: 'FIP-9', duplicate: false });
    expect(jira.held).toHaveLength(1);
  });

  it('holds exactly one issue after two presses, even where the first answer was lost', () => {
    const jira = fakeJira({ dropCreateAnswer: true });

    press(jira);
    const second = press(jira);

    expect(jira.held).toHaveLength(1);
    expect(second.answered).toEqual({ issueKey: 'FIP-9', issueId: 'FIP-9', duplicate: true });
  });

  it('holds exactly one issue after two presses that both answered', () => {
    const jira = fakeJira();

    press(jira);
    const second = press(jira);

    expect(jira.held).toHaveLength(1);
    expect(second.answered?.duplicate).toBe(true);
  });

  it('reads the project before it writes, so the guard can never be skipped', () => {
    const jira = fakeJira();

    press(jira);

    expect(jira.requests[0]?.method).toBe('GET');
    expect(jira.requests[1]?.method).toBe('POST');
  });
});
