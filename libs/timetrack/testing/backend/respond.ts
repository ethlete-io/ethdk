import { TimetrackRequest, TimetrackResponse } from '@ethlete/timetrack';
import { respondGitLab } from './gitlab';
import { respondJira } from './jira';
import { FakeAnswer, FakeRoutedRequest, notFound } from './route';
import { respondTempo } from './tempo';
import { FakeBackend, FakeFault } from './types';

const TEMPO_BASE = 'https://api.tempo.io/4';

const faultFor = (backend: FakeBackend, request: TimetrackRequest): FakeFault | undefined =>
  backend.faults.find(
    (fault) =>
      request.url.includes(fault.url) &&
      (!fault.method || fault.method === request.method) &&
      (fault.times === undefined || fault.times > 0),
  );

const routed = (request: TimetrackRequest, path: string): FakeRoutedRequest => {
  const url = new URL(request.url);

  return { method: request.method, path, query: url.searchParams, body: request.body };
};

const answerFor = (backend: FakeBackend, request: TimetrackRequest): FakeAnswer => {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/rest/api/3')) return respondJira(backend, routed(request, url.pathname));
  if (url.pathname.includes('/api/v4')) return respondGitLab(backend, routed(request, url.pathname));
  if (request.url.startsWith(TEMPO_BASE)) {
    return respondTempo(backend, routed(request, url.pathname.replace(/^\/4/, '')));
  }

  return notFound(routed(request, url.pathname));
};

/**
 * Routes one request into the fake backend and applies whatever it writes. This is the only place a
 * URL is matched, and the only function that mutates `backend`.
 */
export const respond = (backend: FakeBackend, request: TimetrackRequest): TimetrackResponse<unknown> => {
  const fault = faultFor(backend, request);
  const answer = fault ? { status: fault.status, body: fault.body ?? {} } : answerFor(backend, request);

  if (fault?.times !== undefined) fault.times -= 1;

  backend.requests = [...backend.requests, { method: request.method, url: request.url, status: answer.status }];

  return {
    status: answer.status,
    headers: { 'content-type': 'application/json', ...(answer.headers ?? {}) },
    body: answer.body ?? {},
  };
};
