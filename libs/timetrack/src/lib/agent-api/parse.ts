import {
  AGENT_CALENDAR_RANGE_DAYS,
  AGENT_TEMPO_RANGE_DAYS,
  AgentApiRequest,
  AgentApiRowEdit,
  AgentApiWorkCommit,
} from './model';

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

const TEMPO_WORKLOG_ID = /^\d+$/;

const DAY_MS = 24 * 60 * 60_000;

const utcDayOf = (day: string) => {
  if (!DAY_KEY.test(day)) return undefined;

  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const ms = Date.UTC(year, month - 1, date);

  const at = new Date(ms);

  return at.getUTCMonth() === month - 1 && at.getUTCDate() === date ? ms : undefined;
};

const isDayKey = (day: string) => utcDayOf(day) !== undefined;

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

  return isDayKey(day) && paths.length ? { day, paths } : undefined;
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

  if (
    op === 'status' ||
    op === 'jira.instance' ||
    op === 'settings.rules' ||
    op === 'standIn.list' ||
    op === 'lane.issues' ||
    op === 'approvals.list'
  )
    return { ok: true, request: { op } };

  if (op === 'agentSessions.resync') {
    const paths = (Array.isArray(raw['paths']) ? raw['paths'] : []).map(asText).filter(Boolean);

    if (!paths.length) return missing(op, 'paths');

    return { ok: true, request: raw['replace'] === true ? { op, paths, replace: true } : { op, paths } };
  }

  if (op === 'standIn.remove') {
    const id = asText(raw['id']);

    return id ? { ok: true, request: { op, id } } : missing(op, 'id');
  }

  if (op === 'approval.status' || op === 'approval.reject') {
    const id = asText(raw['id']);

    return id ? { ok: true, request: { op, id } } : missing(op, 'id');
  }

  if (op === 'standIn.rename') {
    const id = asText(raw['id']);
    const name = asText(raw['name']);

    if (!id) return missing(op, 'id');

    return name ? { ok: true, request: { op, id, name } } : missing(op, 'name');
  }

  if (op === 'standIn.merge') {
    const id = asText(raw['id']);
    const into = asText(raw['into']);

    if (!id) return missing(op, 'id');

    return into ? { ok: true, request: { op, id, into } } : missing(op, 'into');
  }

  if (op === 'standIn.resolve') {
    const id = asText(raw['id']);
    const issueKey = asText(raw['issueKey']).toUpperCase();
    const name = asText(raw['name']);
    const fromIssueKey = asText(raw['fromIssueKey']).toUpperCase();
    const summary = asText(raw['summary']);

    if (!id) return missing(op, 'id');
    if (!issueKey) return missing(op, 'issueKey');

    return {
      ok: true,
      request: {
        op,
        id,
        issueKey,
        ...(name ? { name } : {}),
        ...(fromIssueKey ? { fromIssueKey } : {}),
        ...(summary ? { summary } : {}),
      },
    };
  }

  if (op === 'standIn.split') {
    const id = asText(raw['id']);
    const branch = asText(raw['branch']);
    const commits = (Array.isArray(raw['commits']) ? raw['commits'] : []).flatMap((entry) => asWorkCommit(entry) ?? []);

    if (!id) return missing(op, 'id');
    if (!branch) return missing(op, 'branch');

    const paths = (Array.isArray(raw['paths']) ? raw['paths'] : []).map(asText).filter(Boolean);
    const projectRoots = (Array.isArray(raw['projectRoots']) ? raw['projectRoots'] : []).map(asText).filter(Boolean);
    const claim = asText(raw['claim']);
    const repoPath = asText(raw['repoPath']);

    return commits.length
      ? {
          ok: true,
          request: {
            op,
            id,
            branch,
            commits,
            projectRoots,
            paths,
            ...(repoPath ? { repoPath } : {}),
            ...(claim ? { claim } : {}),
            apply: asFlag(raw['apply']),
          },
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

    return isDayKey(day) ? { ok: true, request: { op, day } } : missing(op, 'day as YYYY-MM-DD');
  }

  if (op === 'tempo.worklogs' || op === 'calendar.events') {
    const from = asText(raw['from']);
    const to = asText(raw['to']);
    const fromMs = utcDayOf(from);
    const toMs = utcDayOf(to);
    const cap = op === 'tempo.worklogs' ? AGENT_TEMPO_RANGE_DAYS : AGENT_CALENDAR_RANGE_DAYS;

    if (fromMs === undefined) return missing(op, 'from as YYYY-MM-DD');
    if (toMs === undefined) return missing(op, 'to as YYYY-MM-DD');
    if (toMs < fromMs) return failed(`${op} needs from on or before to, not ${from} after ${to}.`);
    if ((toMs - fromMs) / DAY_MS + 1 > cap) return failed(`${op} reads at most ${cap} days at once.`);

    return { ok: true, request: { op, from, to } };
  }

  if (op === 'tempo.sync') {
    const day = asText(raw['day']);
    const planHash = asText(raw['planHash']);

    if (!isDayKey(day)) return missing(op, 'day as YYYY-MM-DD');

    return { ok: true, request: planHash ? { op, day, planHash } : { op, day } };
  }

  if (op === 'tempo.delete') {
    const day = asText(raw['day']);
    const worklogId = asText(raw['worklogId']);

    if (!isDayKey(day)) return missing(op, 'day as YYYY-MM-DD');
    if (!TEMPO_WORKLOG_ID.test(worklogId)) return missing(op, 'numeric worklogId');

    return { ok: true, request: { op, day, worklogId } };
  }

  if (op === 'day.events' || op === 'day.rows' || op === 'day.inputs' || op === 'transcript.day') {
    const day = asText(raw['day']);

    return isDayKey(day) ? { ok: true, request: { op, day } } : missing(op, 'day as YYYY-MM-DD');
  }

  if (op === 'autoMode.ask') {
    const day = asText(raw['day']);
    const standInId = asText(raw['standInId']);
    const contextId = asText(raw['contextId']);

    if (!isDayKey(day)) return missing(op, 'day as YYYY-MM-DD');
    if (standInId && contextId) return failed(`${op} asks about a standInId or a contextId, not both.`);
    if (standInId) return { ok: true, request: { op, day, subject: { kind: 'stand-in', standInId } } };
    if (contextId) return { ok: true, request: { op, day, subject: { kind: 'context', contextId } } };

    return missing(op, 'standInId or contextId');
  }

  if (op === 'day.edits') {
    const day = asText(raw['day']);
    const listed = raw['edits'];

    if (!isDayKey(day)) return missing(op, 'day as YYYY-MM-DD');
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
