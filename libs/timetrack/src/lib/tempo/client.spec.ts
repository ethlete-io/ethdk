import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackResponse, TimetrackTransport } from '../transport/ports';
import { TempoCredentials, TempoPage, TempoRequestError, tempoPaged$, tempoRequest$ } from './client';

const CREDENTIALS: TempoCredentials = { token: 'tempo-secret' };

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

describe('tempoRequest$', () => {
  it('sends the tempo token as a bearer against the v4 base url', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: { ok: true } }]);

    tempoRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/work-attributes',
      describe: 'the schema',
    }).subscribe();

    expect(requests[0]?.url).toBe('https://api.tempo.io/4/work-attributes');
    expect(requests[0]?.headers?.['authorization']).toBe('Bearer tempo-secret');
  });

  it('uses an absolute path verbatim, which is how a next cursor is followed', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: {} }]);

    tempoRequest$({
      transport,
      credentials: CREDENTIALS,
      path: 'https://api.tempo.io/4/worklogs/user/abc?offset=50&limit=50',
      describe: 'page two',
    }).subscribe();

    expect(requests[0]?.url).toBe('https://api.tempo.io/4/worklogs/user/abc?offset=50&limit=50');
  });

  it('encodes a query and drops an undefined value', () => {
    const { transport, requests } = stubTransport([{ status: 200, body: {} }]);

    tempoRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/worklogs',
      describe: 'worklogs',
      query: { from: '2026-08-11', to: undefined, limit: 50 },
    }).subscribe();

    expect(requests[0]?.url).toBe('https://api.tempo.io/4/worklogs?from=2026-08-11&limit=50');
  });

  it('only sends a content type when there is a body', () => {
    const { transport, requests } = stubTransport([
      { status: 200, body: {} },
      { status: 200, body: {} },
    ]);

    tempoRequest$({ transport, credentials: CREDENTIALS, path: '/worklogs', describe: 'read' }).subscribe();
    tempoRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/worklogs',
      describe: 'write',
      method: 'POST',
      body: { timeSpentSeconds: 900 },
    }).subscribe();

    expect(requests[0]?.headers?.['content-type']).toBeUndefined();
    expect(requests[1]?.headers?.['content-type']).toBe('application/json');
  });

  it.each([
    [401, 'Tempo rejected the token (401) for the schema.'],
    [403, 'Tempo rejected the token (403) for the schema.'],
    [404, 'Tempo has no the schema, or the token cannot see it.'],
    [429, 'Tempo rate-limited the request for the schema.'],
    [500, 'Tempo responded 500 for the schema.'],
  ])('turns %i into an error naming what was being read', (status, message) => {
    const { transport } = stubTransport([{ status, body: {} }]);
    const failed = vi.fn();

    tempoRequest$({
      transport,
      credentials: CREDENTIALS,
      path: '/work-attributes',
      describe: 'the schema',
    }).subscribe({ error: failed });

    const error = failed.mock.calls[0]?.[0] as TempoRequestError;

    expect(error).toBeInstanceOf(TempoRequestError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
  });
});

const page = (results: number[], next?: string): TempoPage<{ n: number }> => ({
  results: results.map((n) => ({ n })),
  metadata: next ? { next } : {},
});

describe('tempoPaged$', () => {
  it('asks for the configured page size and concatenates every page in order', () => {
    const { transport, requests } = stubTransport([
      { body: page([1, 2], 'https://api.tempo.io/4/things?offset=2&limit=2') },
      { body: page([3, 4], 'https://api.tempo.io/4/things?offset=4&limit=2') },
      { body: page([5]) },
    ]);
    const seen = vi.fn();

    tempoPaged$<{ n: number }>({
      transport,
      credentials: CREDENTIALS,
      path: '/things',
      describe: 'things',
      options: { pageSize: 2 },
    }).subscribe(seen);

    expect(requests[0]?.url).toBe('https://api.tempo.io/4/things?limit=2');
    expect(requests[1]?.url).toBe('https://api.tempo.io/4/things?offset=2&limit=2');
    expect(seen.mock.calls[0]?.[0]).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]);
  });

  it('stops at maxPages rather than paging a runaway range forever', () => {
    const { transport, requests } = stubTransport(
      Array.from({ length: 10 }, () => ({ body: page([1], 'https://api.tempo.io/4/things?offset=1') })),
    );

    tempoPaged$({
      transport,
      credentials: CREDENTIALS,
      path: '/things',
      describe: 'things',
      options: { pageSize: 1, maxPages: 3 },
    }).subscribe();

    expect(requests).toHaveLength(3);
  });

  it('treats a page with no results as empty rather than failing', () => {
    const { transport } = stubTransport([{ body: {} }]);
    const seen = vi.fn();

    tempoPaged$({ transport, credentials: CREDENTIALS, path: '/things', describe: 'things' }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([]);
  });
});
