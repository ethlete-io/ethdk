import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraCreatableType, creatableTypeNames, fetchJiraCreatableTypes$, mayCreateType } from './createmeta';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const fakeTransport = (body: unknown) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

const read = (body: unknown) => {
  const { transport, requests } = fakeTransport(body);
  let types: JiraCreatableType[] = [];

  fetchJiraCreatableTypes$({ transport, credentials: CREDENTIALS, projectKey: 'FIP' }).subscribe((answer) => {
    types = answer;
  });

  return { types, requests };
};

const type = (options: { id: string; name: string; hierarchyLevel?: number; fields?: unknown }) => ({
  id: options.id,
  name: options.name,
  subtask: false,
  hierarchyLevel: options.hierarchyLevel ?? 0,
  fields: options.fields,
});

describe('fetchJiraCreatableTypes$', () => {
  it('asks Jira what this account may create in this project', () => {
    const { requests } = read({ projects: [] });

    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toContain('/rest/api/3/issue/createmeta');
    expect(requests[0]?.url).toContain('projectKeys=FIP');
  });

  it('reads the types and the fields each one insists on', () => {
    const { types } = read({
      projects: [
        {
          issuetypes: [
            type({
              id: '10001',
              name: 'Task',
              fields: {
                summary: { fieldId: 'summary', required: true },
                description: { fieldId: 'description', required: false },
                customfield_10099: { fieldId: 'customfield_10099', required: true },
              },
            }),
            type({ id: '10002', name: 'Epic', hierarchyLevel: 1 }),
          ],
        },
      ],
    });

    expect(types.map((entry) => entry.name)).toEqual(['Task', 'Epic']);
    expect(types[0]?.requiredFieldIds).toEqual(['customfield_10099', 'summary']);
    expect(types[1]?.hierarchyLevel).toBe(1);
  });

  it('answers nothing for a project the account may create nothing in', () => {
    expect(read({ projects: [{ issuetypes: [] }] }).types).toEqual([]);
    expect(read({}).types).toEqual([]);
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
