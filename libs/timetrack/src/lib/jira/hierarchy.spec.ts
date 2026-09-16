import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { childTypeNameFor, describeJiraHierarchy$, fetchJiraIssueTypes$ } from './hierarchy';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const typesTransport = (body: unknown) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

const FLAT = [
  { id: '1', name: 'Story', hierarchyLevel: 0 },
  { id: '2', name: 'Task', hierarchyLevel: 0 },
  { id: '3', name: 'Epic', hierarchyLevel: 1 },
];

const WITH_SUBTASK = [...FLAT, { id: '4', name: 'Sub-task', subtask: true, hierarchyLevel: -1 }];

describe('fetchJiraIssueTypes$', () => {
  it('reads every visible type by default', () => {
    const { transport, requests } = typesTransport(FLAT);
    const seen = vi.fn();

    fetchJiraIssueTypes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issuetype');
    expect(seen.mock.calls[0]?.[0]).toHaveLength(3);
  });

  it('scopes to a project when one is given', () => {
    const { transport, requests } = typesTransport(FLAT);

    fetchJiraIssueTypes$({ transport, credentials: CREDENTIALS, projectId: '10001' }).subscribe();

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/issuetype/project?projectId=10001');
  });

  it('defaults a type that reports no level or subtask flag', () => {
    const { transport } = typesTransport([{ id: '1', name: 'Story' }]);
    const seen = vi.fn();

    fetchJiraIssueTypes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0][0]).toEqual({ id: '1', name: 'Story', subtask: false, hierarchyLevel: 0 });
  });

  it('skips a type with no id or name rather than inventing one', () => {
    const { transport } = typesTransport([{ name: 'Story' }, { id: '2' }, ...FLAT]);
    const seen = vi.fn();

    fetchJiraIssueTypes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toHaveLength(3);
  });
});

describe('describeJiraHierarchy$', () => {
  it('groups the types by level, highest first', () => {
    const { transport } = typesTransport(WITH_SUBTASK);
    const seen = vi.fn();

    describeJiraHierarchy$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].levels).toEqual([
      { hierarchyLevel: 1, typeNames: ['Epic'] },
      { hierarchyLevel: 0, typeNames: ['Story', 'Task'] },
      { hierarchyLevel: -1, typeNames: ['Sub-task'] },
    ]);
  });

  it('names a type once per level, however many schemes define it', () => {
    const { transport } = typesTransport([...WITH_SUBTASK, { id: '5', name: 'Task', hierarchyLevel: 0 }]);
    const seen = vi.fn();

    describeJiraHierarchy$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].levels[1]).toEqual({ hierarchyLevel: 0, typeNames: ['Story', 'Task'] });
  });

  it('suggests the parent field when the instance has a level below the standard one', () => {
    const { transport } = typesTransport(WITH_SUBTASK);
    const seen = vi.fn();

    describeJiraHierarchy$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].suggestedParenting).toBe('parent-field');
  });

  it('suggests an issue link when story and task share a level', () => {
    const { transport } = typesTransport([FLAT[0], FLAT[1]]);
    const seen = vi.fn();

    describeJiraHierarchy$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0].suggestedParenting).toBe('issue-link');
  });
});

// Exactly what `/rest/api/3/issuetype` answers on the instance this app files into.
const REAL_LEVELS = [
  { name: 'Epic', hierarchyLevel: 1 },
  { name: 'Story', hierarchyLevel: 0 },
  { name: 'Task', hierarchyLevel: 0 },
  { name: 'Bug', hierarchyLevel: 0 },
  { name: 'Sub-Task', hierarchyLevel: -1 },
];

describe('childTypeNameFor', () => {
  const CREATABLE = [
    { name: 'Epic', hierarchyLevel: 1 },
    { name: 'Story', hierarchyLevel: 0 },
    { name: 'Task', hierarchyLevel: 0 },
    { name: 'Sub-Task', hierarchyLevel: -1 },
  ];
  const under = (parentTypeName: string, creatable = CREATABLE) =>
    childTypeNameFor({ parentTypeName, preferredTypeNames: ['Task'], types: REAL_LEVELS, creatable });

  it('files a Task under an epic', () => {
    expect(under('Epic')).toBe('Task');
  });

  it('files a sub-task under a story, rather than the settings’ own type', () => {
    expect(under('Story')).toBe('Sub-Task');
  });

  it('takes the first creatable type on the level when no preferred one sits there', () => {
    expect(
      childTypeNameFor({
        parentTypeName: 'Story',
        preferredTypeNames: ['Task'],
        types: REAL_LEVELS,
        creatable: [{ name: 'Unteraufgabe', hierarchyLevel: -1 }],
      }),
    ).toBe('Unteraufgabe');
  });

  it('answers nothing below a level the account may create nothing under', () => {
    expect(under('Story', [{ name: 'Task', hierarchyLevel: 0 }])).toBeNull();
  });

  it('answers nothing for a parent type the instance does not hold', () => {
    expect(under('Initiative')).toBeNull();
  });
});
