import { describe, expect, it } from 'vitest';
import { E2E_ACCOUNT_ID, E2E_ISSUE_ID, createFakeWorld, tempoWorklogOn } from '../world';
import { respondTempo } from './tempo';
import { FakeBackend, FakeTempoWorklog } from './types';

const DAY = '2026-08-12';

const backendOf = (seed: Parameters<typeof createFakeWorld>[0] = {}) => createFakeWorld(seed).backend;

const call = (options: {
  backend: FakeBackend;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}) =>
  respondTempo(options.backend, {
    method: options.method,
    path: options.path,
    query: new URLSearchParams(options.query ?? {}),
    body: options.body,
  });

const read = (backend: FakeBackend, query: Record<string, string> = { from: DAY, to: DAY }) =>
  call({ backend, method: 'GET', path: `/worklogs/user/${encodeURIComponent(E2E_ACCOUNT_ID)}`, query });

const write = (backend: FakeBackend, part: Partial<Record<string, unknown>> = {}) =>
  call({
    backend,
    method: 'POST',
    path: '/worklogs',
    body: {
      issueId: E2E_ISSUE_ID,
      authorAccountId: E2E_ACCOUNT_ID,
      startDate: DAY,
      startTime: '09:00:00',
      timeSpentSeconds: 3600,
      billableSeconds: 3600,
      description: 'Invite a member by email',
      ...part,
    },
  });

type WorklogResource = {
  tempoWorklogId: string;
  issue: { id: string };
  timeSpentSeconds: number;
  description: string;
  attributes: { values: { key: string; value: string }[] };
};

const resultsOf = (body: unknown) => (body as { results: WorklogResource[] }).results;

describe('respondTempo', () => {
  it('answers every list with metadata that names no next page', () => {
    expect(read(backendOf()).body).toEqual({ results: [], metadata: {} });
  });

  it('reads back a worklog it accepted', () => {
    const backend = backendOf();

    const accepted = write(backend);

    expect(accepted.status).toBe(201);
    expect(accepted.body).toEqual({ tempoWorklogId: 'w-11000' });
    expect(resultsOf(read(backend).body)).toEqual([
      expect.objectContaining({ tempoWorklogId: 'w-11000', issue: { id: E2E_ISSUE_ID }, timeSpentSeconds: 3600 }),
    ]);
  });

  it('records one create per accepted write', () => {
    const backend = backendOf();

    write(backend);

    expect(backend.tempo.writes).toEqual([
      { kind: 'create', worklogId: 'w-11000', issueId: E2E_ISSUE_ID, timeSpentSeconds: 3600 },
    ]);
  });

  it('accepts a repeated write as a second worklog, because idempotence is the app to prove', () => {
    const backend = backendOf();

    write(backend);
    write(backend);

    expect(backend.tempo.worklogs).toHaveLength(2);
    expect(backend.tempo.writes.map((entry) => entry.kind)).toEqual(['create', 'create']);
  });

  it('crosses the work attributes as key and value pairs', () => {
    const backend = backendOf();

    write(backend, { attributes: [{ key: '_Billing_', value: 'Billable' }] });

    expect(resultsOf(read(backend).body)[0]?.attributes.values).toEqual([{ key: '_Billing_', value: 'Billable' }]);
  });

  it('reads only the days the window covers', () => {
    const backend = backendOf({
      tempo: {
        worklogs: [
          tempoWorklogOn({ day: DAY, minutes: 30, id: 'w-on' }),
          tempoWorklogOn({ day: '2026-08-13', minutes: 30, id: 'w-after' }),
        ],
      },
    });

    expect(resultsOf(read(backend).body).map((one) => one.tempoWorklogId)).toEqual(['w-on']);
  });

  it('reads only the worklogs of the account the path names', () => {
    const mine = tempoWorklogOn({ day: DAY, minutes: 30, id: 'w-mine' });
    const theirs: FakeTempoWorklog = { ...mine, id: 'w-theirs', authorAccountId: 'acc:someone-else' };
    const backend = backendOf({ tempo: { worklogs: [mine, theirs] } });

    expect(resultsOf(read(backend).body).map((one) => one.tempoWorklogId)).toEqual(['w-mine']);
  });

  it('updates a held worklog and keeps the issue it belongs to', () => {
    const backend = backendOf({ tempo: { worklogs: [tempoWorklogOn({ day: DAY, minutes: 30, id: 'w-1' })] } });

    const answer = call({
      backend,
      method: 'PUT',
      path: '/worklogs/w-1',
      body: { authorAccountId: E2E_ACCOUNT_ID, startDate: DAY, startTime: '09:00:00', timeSpentSeconds: 5400 },
    });

    expect(answer.status).toBe(200);
    expect(backend.tempo.worklogs[0]).toMatchObject({ id: 'w-1', issueId: E2E_ISSUE_ID, timeSpentSeconds: 5400 });
    expect(backend.tempo.writes).toEqual([{ kind: 'update', worklogId: 'w-1', timeSpentSeconds: 5400 }]);
  });

  it('deletes a held worklog', () => {
    const backend = backendOf({ tempo: { worklogs: [tempoWorklogOn({ day: DAY, minutes: 30, id: 'w-1' })] } });

    const answer = call({ backend, method: 'DELETE', path: '/worklogs/w-1' });

    expect(answer.status).toBe(204);
    expect(backend.tempo.worklogs).toEqual([]);
    expect(backend.tempo.writes).toEqual([{ kind: 'delete', worklogId: 'w-1' }]);
  });

  it('refuses an update to a worklog it does not hold, and records no write', () => {
    const backend = backendOf();

    expect(call({ backend, method: 'PUT', path: '/worklogs/w-missing', body: {} }).status).toBe(404);
    expect(call({ backend, method: 'DELETE', path: '/worklogs/w-missing' }).status).toBe(404);
    expect(backend.tempo.writes).toEqual([]);
  });

  it('answers the seeded work attributes as one page', () => {
    const attribute = { key: '_Billing_', name: 'Billing', type: 'ACCOUNT', required: false, values: ['Billable'] };
    const backend = backendOf({ tempo: { workAttributes: [attribute] } });

    expect(call({ backend, method: 'GET', path: '/work-attributes' }).body).toEqual({
      results: [attribute],
      metadata: {},
    });
  });

  it('answers 404 for a Tempo path it does not route', () => {
    expect(call({ backend: backendOf(), method: 'GET', path: '/accounts' }).status).toBe(404);
  });
});
