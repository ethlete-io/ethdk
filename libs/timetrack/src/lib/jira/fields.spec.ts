import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import { JiraCredentials } from './client';
import { JiraField, fetchJiraFields$, jiraSubjectFieldCandidates } from './fields';

const CREDENTIALS: JiraCredentials = { host: 'https://team.atlassian.net', email: 'you@x.com', token: 't' };

const transportFor = (body: unknown) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body }) as never;
    }),
  };

  return { transport, requests };
};

describe('fetchJiraFields$', () => {
  it('reads every field the instance defines, and drops one answered without an id', () => {
    const { transport, requests } = transportFor([
      { id: 'summary', name: 'Summary', schema: { type: 'string' } },
      { id: 'customfield_1', name: 'Branch subject', custom: true, schema: { type: 'string' } },
      { name: 'no id' },
    ]);
    const found: JiraField[][] = [];

    fetchJiraFields$({ transport, credentials: CREDENTIALS }).subscribe((fields) => found.push(fields));

    expect(requests[0]?.url).toBe('https://team.atlassian.net/rest/api/3/field');
    expect(found[0]).toEqual([
      { id: 'summary', name: 'Summary', custom: false, type: 'string' },
      { id: 'customfield_1', name: 'Branch subject', custom: true, type: 'string' },
    ]);
  });
});

describe('jiraSubjectFieldCandidates', () => {
  it('offers the custom text fields by name, and no built-in one', () => {
    const fields: JiraField[] = [
      { id: 'summary', name: 'Summary', custom: false, type: 'string' },
      { id: 'customfield_2', name: 'Zebra', custom: true, type: 'string' },
      { id: 'customfield_1', name: 'Branch subject', custom: true },
      { id: 'customfield_3', name: 'Sprint', custom: true, type: 'array' },
    ];

    expect(jiraSubjectFieldCandidates(fields).map((field) => field.id)).toEqual(['customfield_1', 'customfield_2']);
  });
});
