import { AgentApiRequest } from './model';

export type AgentApiRequestParse = { ok: true; request: AgentApiRequest } | { ok: false; message: string };

const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asFlag = (value: unknown) => value === true;

const asCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;

const failed = (message: string): AgentApiRequestParse => ({ ok: false, message });

const missing = (op: string, field: string) => failed(`${op} needs a ${field}.`);

/**
 * Reads one request off the wire, or says which field is missing.
 *
 * Every operation is stated in full here rather than passed through: the caller is a CLI in another
 * repository, and the endpoint it reaches holds the only Jira token on the machine. A field this
 * parser does not name cannot reach an operation.
 */
export const parseAgentRequest = (value: unknown): AgentApiRequestParse => {
  const raw = asRecord(value);
  const op = asText(raw['op']);

  if (op === 'status') return { ok: true, request: { op } };

  if (op === 'jira.issue') {
    const key = asText(raw['key']).toUpperCase();

    return key ? { ok: true, request: { op, key } } : missing(op, 'key');
  }

  if (op === 'jira.search') {
    const text = asText(raw['text']);
    const projectKey = asText(raw['projectKey']).toUpperCase();

    return {
      ok: true,
      request: {
        op,
        text,
        projectKey: projectKey || undefined,
        assignedToMe: asFlag(raw['assignedToMe']),
        limit: asCount(raw['limit']),
      },
    };
  }

  if (op === 'repo.project') {
    const repoPath = asText(raw['repoPath']);

    return repoPath ? { ok: true, request: { op, repoPath } } : missing(op, 'repoPath');
  }

  if (op === 'jira.create') {
    const summary = asText(raw['summary']);

    if (!summary) return missing(op, 'summary');

    return {
      ok: true,
      request: {
        op,
        summary,
        description: asText(raw['description']),
        projectKey: asText(raw['projectKey']).toUpperCase() || undefined,
        issueTypeName: asText(raw['issueTypeName']) || undefined,
        parentKey: asText(raw['parentKey']).toUpperCase() || undefined,
        subject: asText(raw['subject']) || undefined,
      },
    };
  }

  if (op === 'worklog.add') {
    const issueKey = asText(raw['issueKey']).toUpperCase();
    const fromMs = asCount(raw['fromMs']);
    const durationMs = asCount(raw['durationMs']);

    if (!issueKey) return missing(op, 'issueKey');
    if (fromMs === undefined) return missing(op, 'fromMs');
    if (durationMs === undefined || durationMs <= 0) return missing(op, 'durationMs above zero');

    return { ok: true, request: { op, issueKey, description: asText(raw['description']), fromMs, durationMs } };
  }

  return failed(op ? `Timetrack has no operation named ${op}.` : 'The request names no operation.');
};
