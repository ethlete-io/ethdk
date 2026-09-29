import { QueryDevtoolsEntry } from '@ethlete/query';
import { describe, expect, it } from 'vitest';
import { resolveQueryDevtoolsEventOwner } from './query-devtools-event-owner';
import { EventLogItem } from './query-devtools-types';

const entry = (id: string, request: { url: string }, destroyedAt?: number) =>
  ({ id, kind: 'query', destroyedAt, handle: { subtle: { request: () => request } } }) as unknown as QueryDevtoolsEntry;

const event = (request: { url: string } | null, url: string, timestamp = 1000): EventLogItem => ({
  id: 1,
  timestamp,
  client: 'api',
  type: 'request-success',
  method: 'GET',
  url,
  isSecure: false,
  status: null,
  request: request ? new WeakRef(request) : null,
  cause: null,
  destroyCause: null,
  refreshed: null,
  durationMs: null,
  bytes: null,
  isEstimatedBytes: false,
});

describe('resolveQueryDevtoolsEventOwner', () => {
  it('should prefer the live query holding the very request over one on the same url', () => {
    const request = { url: '/posts' };
    const entries = [entry('other', { url: '/posts' }), entry('owner', request)];

    expect(resolveQueryDevtoolsEventOwner(entries, event(request, '/posts'))).toBe('owner');
  });

  it('should fall back to a live query on the same url', () => {
    const entries = [entry('a', { url: '/users' }), entry('b', { url: '/posts' })];

    expect(resolveQueryDevtoolsEventOwner(entries, event({ url: '/posts' }, '/posts'))).toBe('b');
  });

  it('should pick the tombstone destroyed nearest the event', () => {
    const entries = [
      entry('early', { url: '/posts' }, 100),
      entry('near', { url: '/posts' }, 1005),
      entry('late', { url: '/posts' }, 5000),
    ];

    expect(resolveQueryDevtoolsEventOwner(entries, event(null, '/posts', 1000))).toBe('near');
  });

  it('should resolve nothing for an event that is not about a request', () => {
    expect(resolveQueryDevtoolsEventOwner([entry('a', { url: '/posts' })], { ...event(null, ''), url: null })).toBe(
      null,
    );
  });
});
