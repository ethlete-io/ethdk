import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraCreatableType, creatableTypeNames, fetchJiraCreatableTypes$, mayCreateType } from './createmeta';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const routedTransport = (answer: (path: string, startAt: number) => unknown) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      const url = new URL(request.url);
      const body = answer(url.pathname, Number(url.searchParams.get('startAt') ?? 0));

      return of({ status: 200, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

const read = (answer: (path: string, startAt: number) => unknown) => {
  const { transport, requests } = routedTransport(answer);
  let types: JiraCreatableType[] = [];
  let failure: unknown;

  fetchJiraCreatableTypes$({ transport, credentials: CREDENTIALS, projectKey: 'FIP' }).subscribe({
    next: (answered) => {
      types = answered;
    },
    error: (error: unknown) => {
      failure = error;
    },
  });

  return { types, requests, failure };
};

const TYPES_PATH = '/rest/api/3/issue/createmeta/FIP/issuetypes';

const field = (fieldId: string, required: boolean) => ({ fieldId, key: fieldId, name: fieldId, required });

describe('fetchJiraCreatableTypes$', () => {
  it('asks the per-project createmeta read what this account may create', () => {
    const { requests } = read(() => ({ issueTypes: [], total: 0 }));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(TYPES_PATH);
    expect(requests[0]?.url).toContain('maxResults=200');
  });

  it('reads the types, then the fields each one insists on', () => {
    const { types, requests } = read((path) => {
      if (path === TYPES_PATH) {
        return {
          issueTypes: [
            { id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0 },
            { id: '10002', name: 'Epic', subtask: false, hierarchyLevel: 1 },
            { name: 'Nameless' },
          ],
          startAt: 0,
          maxResults: 200,
          total: 3,
        };
      }

      if (path === `${TYPES_PATH}/10001`) {
        return {
          fields: [field('summary', true), field('description', false), field('customfield_10099', true)],
          total: 3,
        };
      }

      return { fields: [field('summary', true)], total: 1 };
    });

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      TYPES_PATH,
      `${TYPES_PATH}/10001`,
      `${TYPES_PATH}/10002`,
    ]);
    expect(types).toEqual([
      {
        id: '10001',
        name: 'Task',
        subtask: false,
        hierarchyLevel: 0,
        requiredFieldIds: ['customfield_10099', 'summary'],
      },
      { id: '10002', name: 'Epic', subtask: false, hierarchyLevel: 1, requiredFieldIds: ['summary'] },
    ]);
  });

  it('reads the alternate array names the schema also documents', () => {
    const { types } = read((path) =>
      path === TYPES_PATH
        ? { createMetaIssueType: [{ id: '10001', name: 'Task' }], total: 1 }
        : { results: [field('summary', true)], total: 1 },
    );

    expect(types).toEqual([
      { id: '10001', name: 'Task', subtask: false, hierarchyLevel: 0, requiredFieldIds: ['summary'] },
    ]);
  });

  it('follows startAt until the total is read', () => {
    const { types, requests } = read((path, startAt) => {
      if (path === TYPES_PATH) return { issueTypes: [{ id: '10001', name: 'Task' }], total: 1 };

      return startAt === 0
        ? { fields: [field('summary', true)], startAt: 0, total: 2 }
        : { fields: [field('customfield_10099', true)], startAt: 1, total: 2 };
    });

    expect(requests[2]?.url).toContain('startAt=1');
    expect(types[0]?.requiredFieldIds).toEqual(['customfield_10099', 'summary']);
  });

  it('errors rather than answer with part of a field list that never ends', () => {
    const { failure } = read((path, startAt) =>
      path === TYPES_PATH
        ? { issueTypes: [{ id: '10001', name: 'Task' }], total: 1 }
        : { fields: [field(`customfield_${startAt}`, true)], total: 1_000 },
    );

    expect(failure).toBeInstanceOf(Error);
  });

  it('answers nothing for a project the account may create nothing in', () => {
    expect(read(() => ({ issueTypes: [], total: 0 })).types).toEqual([]);
    expect(read(() => ({})).types).toEqual([]);
  });
});

describe('mayCreateType', () => {
  const types = [
    { id: '1', name: 'Task', subtask: false, hierarchyLevel: 0, requiredFieldIds: [] },
    { id: '2', name: 'Epic', subtask: false, hierarchyLevel: 1, requiredFieldIds: [] },
  ];

  it('matches the name settings hold, whatever its case', () => {
    expect(mayCreateType({ typeName: ' epic ', types })).toBe(true);
    expect(mayCreateType({ typeName: 'Story', types })).toBe(false);
  });

  it('keeps only the levels the account may file, in the order settings hold them', () => {
    expect(creatableTypeNames({ typeNames: ['Epic', 'Story', 'Task'], types })).toEqual(['Epic', 'Task']);
  });

  it('keeps nothing where Jira permits nothing, which is what hides the button', () => {
    expect(creatableTypeNames({ typeNames: ['Epic'], types: [] })).toEqual([]);
  });
});
