import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from '../jira/client';
import { JiraIssueInput } from '../jira/create';
import { FiledTicket, fileTicketOnce$ } from './file';

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
const fakeJira = (
  options: { dropCreateAnswer?: boolean; refuseLink?: boolean; startsDone?: boolean; olderOpenIssues?: number } = {},
) => {
  const held: { key: string; summary: string; done: boolean }[] = Array.from(
    { length: options.olderOpenIssues ?? 0 },
    (_, index) => ({ key: `FIP-OLD-${index}`, summary: `Older work ${index}`, done: false }),
  );
  const requests: TimetrackRequest[] = [];
  let next = 9;

  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      if (request.url.endsWith('/issueLink')) {
        return of({
          status: options.refuseLink ? 400 : 201,
          headers: {},
          body: options.refuseLink ? { errorMessages: ['No link type named Relates.'] } : {},
        }) as never;
      }

      if (request.method === 'POST' && request.url.endsWith('/issue')) {
        const fields = (request.body as { fields: { summary: string } }).fields;
        const key = `FIP-${next++}`;

        held.push({ key, summary: fields.summary, done: !!options.startsDone });

        return of({
          status: 201,
          headers: {},
          body: options.dropCreateAnswer ? {} : { id: key, key },
        }) as never;
      }

      const query = new URL(request.url).searchParams;
      const jql = query.get('jql') ?? '';
      const newestFirst = jql.includes('ORDER BY created DESC');
      const answered = (newestFirst ? [...held].reverse() : held)
        .filter((issue) => !issue.done || jql.includes('created >= -1d') || !jql.includes('statusCategory != Done'))
        .slice(0, Number(query.get('maxResults') ?? held.length));

      return of({
        status: 200,
        headers: {},
        body: { issues: answered.map((issue) => resource(issue.key, issue.summary)) },
      }) as never;
    }),
  };

  return { transport, held, requests };
};

const press = (jira: { transport: TimetrackTransport }, input: JiraIssueInput = INPUT) => {
  let answered: FiledTicket | undefined;
  let failed: unknown;

  fileTicketOnce$({ transport: jira.transport, credentials: CREDENTIALS, input }).subscribe({
    next: (filed) => (answered = filed),
    error: (error: unknown) => (failed = error),
  });

  return { answered, failed };
};

describe('fileTicketOnce$', () => {
  it('answers the filed ticket with why its parent link failed', () => {
    const jira = fakeJira({ refuseLink: true });
    const { answered } = press(jira, { ...INPUT, parentKey: 'FIP-1', parenting: 'issue-link' });

    expect(answered?.issueKey).toBe('FIP-9');
    expect(answered?.linkError).toContain('No link type named Relates.');
  });

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

  it('finds a lost create that landed in a done status', () => {
    const jira = fakeJira({ dropCreateAnswer: true, startsDone: true });

    press(jira);
    press(jira);

    expect(jira.held).toHaveLength(1);
  });

  it('finds a lost create in a project with more open issues than one page holds', () => {
    const jira = fakeJira({ dropCreateAnswer: true, olderOpenIssues: 150 });

    press(jira);
    press(jira);

    expect(jira.held).toHaveLength(151);
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
