import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackResponse, TimetrackTransport } from '../transport/ports';
import { TempoCredentials, TempoRequestError } from './client';
import { TempoWorklogWrite, createTempoWorklog$, deleteTempoWorklog$, updateTempoWorklog$ } from './write';

const CREDENTIALS: TempoCredentials = { token: 'tempo-secret' };
const HOUR = 3_600_000;

const stubTransport = (responses: Partial<TimetrackResponse<unknown>>[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      const response = responses[requests.length] ?? { status: 200, body: {} };

      requests.push(request);

      return of({ status: response.status ?? 200, headers: {}, body: response.body }) as never;
    }),
  };

  return { transport, requests };
};

const write = (overrides: Partial<TempoWorklogWrite> = {}): TempoWorklogWrite => ({
  authorAccountId: 'acc:123',
  issueId: '10100',
  from: new Date(2026, 7, 11, 9, 30, 0),
  durationMs: HOUR,
  description: 'Logout on idle',
  ...overrides,
});

type WorklogBody = {
  authorAccountId?: string;
  issueId?: unknown;
  startDate?: string;
  startTime?: string;
  timeSpentSeconds?: number;
  billableSeconds?: number;
  description?: string;
  attributes?: { key: string; value: unknown }[];
};

const bodyOf = (request: TimetrackRequest | undefined) => (request?.body ?? {}) as WorklogBody;

describe('createTempoWorklog$', () => {
  it('posts the numeric issue id and the local wall clock', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);

    createTempoWorklog$({ transport, credentials: CREDENTIALS, write: write() }).subscribe();

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe('https://api.tempo.io/4/worklogs');
    expect(bodyOf(requests[0])).toMatchObject({
      authorAccountId: 'acc:123',
      issueId: 10100,
      startDate: '2026-08-11',
      startTime: '09:30:00',
      timeSpentSeconds: 3600,
      description: 'Logout on idle',
    });
  });

  it('answers with the new worklog id, which is what owns it from then on', () => {
    const { transport } = stubTransport([{ status: 200, body: { tempoWorklogId: 555 } }]);
    const ids: string[] = [];

    createTempoWorklog$({ transport, credentials: CREDENTIALS, write: write() }).subscribe((id) => ids.push(id));

    expect(ids).toEqual(['555']);
  });

  it('sends attribute values as tempo key/value pairs', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 1 } }]);

    createTempoWorklog$({
      transport,
      credentials: CREDENTIALS,
      write: write({ attributes: { _Billable_: true, _Category_: 'dev' } }),
    }).subscribe();

    expect(bodyOf(requests[0]).attributes).toEqual([
      { key: '_Billable_', value: true },
      { key: '_Category_', value: 'dev' },
    ]);
  });

  it('omits the billable seconds when the caller has no policy for them', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 1 } }]);

    createTempoWorklog$({ transport, credentials: CREDENTIALS, write: write() }).subscribe();

    expect(bodyOf(requests[0]).billableSeconds).toBeUndefined();
  });

  it('sends the billable seconds when it has one', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { tempoWorklogId: 1 } }]);

    createTempoWorklog$({
      transport,
      credentials: CREDENTIALS,
      write: write({ billableMs: HOUR / 2 }),
    }).subscribe();

    expect(bodyOf(requests[0]).billableSeconds).toBe(1800);
  });

  it('fails when tempo returns no worklog id, rather than reporting an unowned worklog as written', () => {
    const { transport } = stubTransport([{ status: 200, body: {} }]);
    const errors: unknown[] = [];

    createTempoWorklog$({ transport, credentials: CREDENTIALS, write: write() }).subscribe({
      error: (error: unknown) => errors.push(error),
    });

    expect(errors[0]).toBeInstanceOf(TempoRequestError);
  });

  it('surfaces a rejected write as a tempo error', () => {
    const { transport } = stubTransport([{ status: 400, body: { errors: ['bad attribute'] } }]);
    const errors: TempoRequestError[] = [];

    createTempoWorklog$({ transport, credentials: CREDENTIALS, write: write() }).subscribe({
      error: (error: TempoRequestError) => errors.push(error),
    });

    expect(errors[0]?.status).toBe(400);
  });
});

describe('updateTempoWorklog$', () => {
  it('puts the content to the worklog url', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: {} }]);

    updateTempoWorklog$({ transport, credentials: CREDENTIALS, tempoWorklogId: '555', write: write() }).subscribe();

    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url).toBe('https://api.tempo.io/4/worklogs/555');
  });

  it('sends no issue id: tempo v4 cannot move a worklog to another issue', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: {} }]);

    updateTempoWorklog$({ transport, credentials: CREDENTIALS, tempoWorklogId: '555', write: write() }).subscribe();

    expect(bodyOf(requests[0]).issueId).toBeUndefined();
    expect(bodyOf(requests[0]).timeSpentSeconds).toBe(3600);
  });
});

describe('deleteTempoWorklog$', () => {
  it('deletes the worklog and accepts an empty response', () => {
    const { transport, requests } = stubTransport([{ status: 204, body: undefined }]);
    let completed = false;

    deleteTempoWorklog$({ transport, credentials: CREDENTIALS, tempoWorklogId: '555' }).subscribe({
      complete: () => (completed = true),
    });

    expect(requests[0]?.method).toBe('DELETE');
    expect(requests[0]?.url).toBe('https://api.tempo.io/4/worklogs/555');
    expect(completed).toBe(true);
  });
});
