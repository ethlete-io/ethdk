import { FakeAnswer, FakeRoutedRequest, bodyOf, created, noContent, notFound, ok, stringOf } from './route';
import { FakeBackend, FakeTempoWorklog } from './types';

const numberOf = (holder: Record<string, unknown>, key: string) => {
  const value = holder[key];

  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
};

const attributesOf = (holder: Record<string, unknown>) => {
  const raw = holder['attributes'];
  const values: Record<string, string> = {};

  if (!Array.isArray(raw)) return values;

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;

    const pair = entry as Record<string, unknown>;
    const key = stringOf(pair, 'key');

    if (key && pair['value'] !== undefined && pair['value'] !== null) values[key] = String(pair['value']);
  }

  return values;
};

const worklogResource = (worklog: FakeTempoWorklog) => ({
  tempoWorklogId: worklog.id,
  issue: { id: worklog.issueId },
  author: { accountId: worklog.authorAccountId },
  startDate: worklog.startDate,
  startTime: worklog.startTime,
  timeSpentSeconds: worklog.timeSpentSeconds,
  billableSeconds: worklog.billableSeconds,
  description: worklog.description,
  attributes: { values: Object.entries(worklog.attributes).map(([key, value]) => ({ key, value })) },
});

/** `page.metadata` must be present with no `next`, or `tempoPaged$` asks for a second page forever. */
const page = (results: unknown[]) => ok({ results, metadata: {} });

const readWorklogs = (options: { backend: FakeBackend; accountId: string; request: FakeRoutedRequest }): FakeAnswer => {
  const { backend, accountId, request } = options;
  const from = request.query.get('from') ?? '';
  const to = request.query.get('to') ?? '';

  const matched = backend.tempo.worklogs.filter(
    (worklog) =>
      worklog.authorAccountId === accountId && (!from || worklog.startDate >= from) && (!to || worklog.startDate <= to),
  );

  return page(matched.map(worklogResource));
};

const worklogFrom = (request: FakeRoutedRequest, id: string): FakeTempoWorklog => {
  const body = bodyOf(request);

  return {
    id,
    issueId: String(body['issueId'] ?? ''),
    authorAccountId: stringOf(body, 'authorAccountId') ?? '',
    startDate: stringOf(body, 'startDate') ?? '',
    startTime: stringOf(body, 'startTime') ?? '',
    timeSpentSeconds: numberOf(body, 'timeSpentSeconds'),
    billableSeconds: numberOf(body, 'billableSeconds'),
    description: stringOf(body, 'description') ?? '',
    attributes: attributesOf(body),
  };
};

const createWorklog = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const worklog = worklogFrom(request, `w-${backend.nextId++}`);

  backend.tempo.worklogs = [...backend.tempo.worklogs, worklog];
  backend.tempo.writes = [
    ...backend.tempo.writes,
    {
      kind: 'create',
      worklogId: worklog.id,
      issueId: worklog.issueId,
      timeSpentSeconds: worklog.timeSpentSeconds,
    },
  ];

  return created({ tempoWorklogId: worklog.id });
};

const updateWorklog = (options: { backend: FakeBackend; request: FakeRoutedRequest; id: string }): FakeAnswer => {
  const { backend, request, id } = options;
  const held = backend.tempo.worklogs.find((worklog) => worklog.id === id);

  if (!held) return notFound(request);

  const next = { ...worklogFrom(request, id), issueId: held.issueId };

  backend.tempo.worklogs = backend.tempo.worklogs.map((worklog) => (worklog.id === id ? next : worklog));
  backend.tempo.writes = [
    ...backend.tempo.writes,
    { kind: 'update', worklogId: id, timeSpentSeconds: next.timeSpentSeconds },
  ];

  return ok(worklogResource(next));
};

const deleteWorklog = (options: { backend: FakeBackend; request: FakeRoutedRequest; id: string }): FakeAnswer => {
  const { backend, request, id } = options;
  if (!backend.tempo.worklogs.some((worklog) => worklog.id === id)) return notFound(request);

  backend.tempo.worklogs = backend.tempo.worklogs.filter((worklog) => worklog.id !== id);
  backend.tempo.writes = [...backend.tempo.writes, { kind: 'delete', worklogId: id }];

  return noContent();
};

/** Answers a Tempo v4 call, and applies the writes to `backend.tempo`. */
export const respondTempo = (backend: FakeBackend, request: FakeRoutedRequest): FakeAnswer => {
  const { path, method } = request;

  if (path === '/work-attributes') return page(backend.tempo.workAttributes);

  const forUser = /^\/worklogs\/user\/(.+)$/.exec(path);

  if (forUser) return readWorklogs({ backend, accountId: decodeURIComponent(forUser[1] ?? ''), request });

  if (path === '/worklogs' && method === 'POST') return createWorklog(backend, request);

  const byId = /^\/worklogs\/(.+)$/.exec(path);

  if (byId) {
    const id = decodeURIComponent(byId[1] ?? '');

    if (method === 'PUT') return updateWorklog({ backend, request, id });
    if (method === 'DELETE') return deleteWorklog({ backend, request, id });
  }

  return notFound(request);
};
