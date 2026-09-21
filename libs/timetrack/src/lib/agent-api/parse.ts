import { AgentApiRequest, AgentApiRowEdit, AgentApiWorkCommit } from './model';

export type AgentApiRequestParse = { ok: true; request: AgentApiRequest } | { ok: false; message: string };

const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asFlag = (value: unknown) => value === true;

const asCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;

const failed = (message: string): AgentApiRequestParse => ({ ok: false, message });

const missing = (op: string, field: string) => failed(`${op} needs a ${field}.`);

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads one row edit, or nothing where the caller named no row or no change this endpoint makes.
 *
 * An entry it refuses is dropped rather than failing the whole write. A caller sends the edits it
 * read off one day, and `day.edits` answers how many landed, so a dropped entry is visible without
 * costing the caller the edits beside it.
 */
const asRowEdit = (value: unknown): AgentApiRowEdit | undefined => {
  const raw = asRecord(value);
  const kind = asText(raw['kind']);
  const rowId = asText(raw['rowId']);

  if (!rowId) return undefined;

  if (kind === 'range') {
    const fromMs = asCount(raw['fromMs']);
    const toMs = asCount(raw['toMs']);

    return fromMs !== undefined && toMs !== undefined && toMs > fromMs ? { kind, rowId, fromMs, toMs } : undefined;
  }

  if (kind === 'issue') {
    const issueKey = asText(raw['issueKey']).toUpperCase();

    return issueKey ? { kind, rowId, issueKey } : undefined;
  }

  if (kind === 'description') return { kind, rowId, description: asText(raw['description']) };

  if (kind === 'state') {
    const state = asText(raw['state']);

    return state === 'accepted' || state === 'rejected' ? { kind, rowId, state } : undefined;
  }

  if (kind === 'hidden') return { kind, rowId, hidden: asFlag(raw['hidden']) };

  if (kind === 'reset') return { kind, rowId };

  return undefined;
};

/** One commit of a split, or nothing where it names no day or changed no file. */
const asWorkCommit = (value: unknown): AgentApiWorkCommit | undefined => {
  const raw = asRecord(value);
  const day = asText(raw['day']);
  const paths = (Array.isArray(raw['paths']) ? raw['paths'] : []).map(asText).filter(Boolean);

  return DAY_KEY.test(day) && paths.length ? { day, paths } : undefined;
};

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

  if (op === 'status' || op === 'jira.instance' || op === 'settings.rules' || op === 'standIn.list')
    return { ok: true, request: { op } };

  if (op === 'standIn.remove') {
    const id = asText(raw['id']);

    return id ? { ok: true, request: { op, id } } : missing(op, 'id');
  }

  if (op === 'standIn.split') {
    const id = asText(raw['id']);
    const branch = asText(raw['branch']);
    const commits = (Array.isArray(raw['commits']) ? raw['commits'] : []).flatMap((entry) => asWorkCommit(entry) ?? []);

    if (!id) return missing(op, 'id');
    if (!branch) return missing(op, 'branch');

    const paths = (Array.isArray(raw['paths']) ? raw['paths'] : []).map(asText).filter(Boolean);
    const claim = asText(raw['claim']);

    return commits.length
      ? {
          ok: true,
          request: { op, id, branch, commits, paths, ...(claim ? { claim } : {}), apply: asFlag(raw['apply']) },
        }
      : missing(op, 'commits');
  }

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

  if (op === 'naming.offers') {
    const day = asText(raw['day']);

    return DAY_KEY.test(day) ? { ok: true, request: { op, day } } : missing(op, 'day as YYYY-MM-DD');
  }

  if (op === 'day.events' || op === 'day.rows') {
    const day = asText(raw['day']);

    return DAY_KEY.test(day) ? { ok: true, request: { op, day } } : missing(op, 'day as YYYY-MM-DD');
  }

  if (op === 'day.edits') {
    const day = asText(raw['day']);
    const listed = raw['edits'];

    if (!DAY_KEY.test(day)) return missing(op, 'day as YYYY-MM-DD');
    if (!Array.isArray(listed)) return missing(op, 'list of edits');

    const edits = listed.map(asRowEdit).filter((edit): edit is AgentApiRowEdit => !!edit);

    return edits.length
      ? { ok: true, request: { op, day, edits } }
      : failed('day.edits was given no edit this endpoint makes.');
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
