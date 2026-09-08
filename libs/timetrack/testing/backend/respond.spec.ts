import { TimetrackRequest, TimetrackRequestMethod } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { E2E_ACCOUNT_ID, E2E_GITLAB_HOST, E2E_JIRA_HOST, E2E_PROJECT_PATH, createFakeWorld } from '../world';
import { respond } from './respond';
import { FakeBackend } from './types';

const TEMPO_WORKLOGS = `https://api.tempo.io/4/worklogs/user/${encodeURIComponent(E2E_ACCOUNT_ID)}`;
const GITLAB_MERGE_REQUESTS = `${E2E_GITLAB_HOST}/api/v4/projects/${encodeURIComponent(E2E_PROJECT_PATH)}/merge_requests`;

const backendOf = (seed: Parameters<typeof createFakeWorld>[0] = {}) => createFakeWorld(seed).backend;

const call = (backend: FakeBackend, part: { method?: TimetrackRequestMethod; url: string; body?: unknown }) => {
  const request: TimetrackRequest = { method: part.method ?? 'GET', url: part.url, body: part.body };

  return respond(backend, request);
};

describe('respond', () => {
  it('routes a Jira url into the Jira state', () => {
    const answer = call(backendOf(), { url: `${E2E_JIRA_HOST}/rest/api/3/myself` });

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ accountId: E2E_ACCOUNT_ID });
  });

  it('routes a Tempo url into the Tempo state', () => {
    expect(call(backendOf(), { url: TEMPO_WORKLOGS }).body).toEqual({ results: [], metadata: {} });
  });

  it('routes a GitLab url into the GitLab state', () => {
    expect(call(backendOf(), { url: GITLAB_MERGE_REQUESTS }).body).toEqual([]);
  });

  it('answers every request as JSON', () => {
    expect(call(backendOf(), { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).headers).toMatchObject({
      'content-type': 'application/json',
    });
  });

  it('answers 404 for a host it does not know, rather than an empty body a flow reads as success', () => {
    const answer = call(backendOf(), { url: 'https://slack.com/api/chat.postMessage' });

    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ errorMessages: [expect.stringContaining('/api/chat.postMessage')] });
  });

  it('logs every request with the status it answered', () => {
    const backend = backendOf();

    call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` });
    call(backend, { url: 'https://slack.com/api/chat.postMessage' });

    expect(backend.requests).toEqual([
      { method: 'GET', url: `${E2E_JIRA_HOST}/rest/api/3/myself`, status: 200 },
      { method: 'GET', url: 'https://slack.com/api/chat.postMessage', status: 404 },
    ]);
  });

  it('refuses a request a fault names, by a substring of the url', () => {
    const backend = backendOf({ faults: [{ url: '/worklogs', status: 401, body: { message: 'Token expired' } }] });

    const answer = call(backend, { url: TEMPO_WORKLOGS });

    expect(answer.status).toBe(401);
    expect(answer.body).toEqual({ message: 'Token expired' });
  });

  it('leaves a request the fault does not name alone', () => {
    const backend = backendOf({ faults: [{ url: '/worklogs', status: 401 }] });

    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).status).toBe(200);
  });

  it('refuses only the method the fault names', () => {
    const backend = backendOf({ faults: [{ url: '/worklogs', method: 'POST', status: 403 }] });

    expect(call(backend, { url: TEMPO_WORKLOGS }).status).toBe(200);
    expect(call(backend, { method: 'POST', url: 'https://api.tempo.io/4/worklogs', body: {} }).status).toBe(403);
  });

  it('answers an empty body when the fault names none, so a client still parses the refusal', () => {
    const backend = backendOf({ faults: [{ url: '/myself', status: 429 }] });

    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).body).toEqual({});
  });

  it('spends a counted fault, then answers normally — which is how a retry is tested', () => {
    const backend = backendOf({ faults: [{ url: '/myself', status: 429, times: 1 }] });

    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).status).toBe(429);
    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).status).toBe(200);
  });

  it('refuses every matching request when the fault counts none', () => {
    const backend = backendOf({ faults: [{ url: '/myself', status: 401 }] });

    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).status).toBe(401);
    expect(call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` }).status).toBe(401);
  });

  it('writes a refusal to the request log too', () => {
    const backend = backendOf({ faults: [{ url: '/myself', status: 401 }] });

    call(backend, { url: `${E2E_JIRA_HOST}/rest/api/3/myself` });

    expect(backend.requests).toEqual([{ method: 'GET', url: `${E2E_JIRA_HOST}/rest/api/3/myself`, status: 401 }]);
  });

  it('reads the query string a Jira search sent', () => {
    const backend = backendOf();
    const url = new URL(`${E2E_JIRA_HOST}/rest/api/3/search/jql`);

    url.searchParams.set('jql', 'text ~ "member*"');
    url.searchParams.set('fields', 'summary');

    const answer = call(backend, { url: url.toString() });

    expect((answer.body as { issues: { key: string }[] }).issues.map((issue) => issue.key)).toEqual(['ABC-2000']);
  });
});
