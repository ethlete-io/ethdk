import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { describeJiraHierarchy$, describeParentRule, fetchJiraIssueTypes$, parentTypeNamesFor } from './hierarchy';

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

describe('parentTypeNamesFor', () => {
  it('drops a type sitting on the child’s own level', () => {
    expect(parentTypeNamesFor({ childTypeName: 'Task', typeNames: ['Story', 'Epic'], types: REAL_LEVELS })).toEqual([
      'Epic',
    ]);
  });

  it('matches a name however settings cased or spaced it', () => {
    expect(parentTypeNamesFor({ childTypeName: ' task ', typeNames: [' epic '], types: REAL_LEVELS })).toEqual([
      ' epic ',
    ]);
  });

  it('drops a type no read holds, rather than guessing its level', () => {
    expect(parentTypeNamesFor({ childTypeName: 'Task', typeNames: ['Initiative'], types: REAL_LEVELS })).toEqual([]);
  });

  it('answers nothing when the child type itself is unknown', () => {
    expect(parentTypeNamesFor({ childTypeName: 'Aufgabe', typeNames: ['Epic'], types: REAL_LEVELS })).toEqual([]);
  });

  it('offers only the nearest level above, never one two steps up', () => {
    const withInitiative = [...REAL_LEVELS, { name: 'Initiative', hierarchyLevel: 2 }];

    expect(
      parentTypeNamesFor({ childTypeName: 'Task', typeNames: ['Initiative', 'Epic'], types: withInitiative }),
    ).toEqual(['Epic']);
  });

  it('takes the nearest level that exists when the one just above does not', () => {
    const noEpics = [
      { name: 'Task', hierarchyLevel: 0 },
      { name: 'Initiative', hierarchyLevel: 2 },
    ];

    expect(parentTypeNamesFor({ childTypeName: 'Task', typeNames: ['Initiative'], types: noEpics })).toEqual([
      'Initiative',
    ]);
  });

  it('lets a sub-task take the level above it', () => {
    expect(parentTypeNamesFor({ childTypeName: 'Sub-Task', typeNames: ['Story', 'Epic'], types: REAL_LEVELS })).toEqual(
      ['Story'],
    );
  });
});

describe('describeParentRule', () => {
  it('says nothing when the hierarchy dropped nothing', () => {
    expect(describeParentRule({ childTypeName: 'Task', configured: ['Epic'], allowed: ['Epic'] })).toBeNull();
  });

  it('names the one type left', () => {
    expect(describeParentRule({ childTypeName: 'Task', configured: ['Story', 'Epic'], allowed: ['Epic'] })).toBe(
      'Only Epic can be the parent of a Task here.',
    );
  });

  it('joins the types left with “or”', () => {
    expect(
      describeParentRule({
        childTypeName: 'Task',
        configured: ['Story', 'Epic', 'Feature'],
        allowed: ['Epic', 'Feature'],
      }),
    ).toBe('Only Epic or Feature can be the parent of a Task here.');
  });

  it('says so when the hierarchy leaves no parent at all', () => {
    expect(describeParentRule({ childTypeName: 'Task', configured: ['Story'], allowed: [] })).toBe(
      'Jira accepts no parent for a Task here.',
    );
  });
});
