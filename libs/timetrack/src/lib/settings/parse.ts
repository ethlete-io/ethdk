import { ProjectLinkTarget, TimetrackProjectLink } from '../correlate/project-link';
import { AttributionRule, AttributionTarget } from '../correlate/rules';
import { REASONING_COMMANDS } from '../reason/model';
import { TimetrackExclusionRule } from '../store/exclusion';
import {
  DEFAULT_TIMETRACK_SETTINGS,
  TimetrackFavoriteProject,
  TimetrackNudgeSettings,
  TimetrackReasoningSettings,
  TimetrackSettings,
  TimetrackTicketSettings,
  clampDayTargetMs,
  clampGapFillMs,
  clampMinuteOfDay,
} from './model';

const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asTarget = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampDayTargetMs(value)
    : DEFAULT_TIMETRACK_SETTINGS.dayTargetMs;

const asGapFill = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? clampGapFillMs(value) : DEFAULT_TIMETRACK_SETTINGS.gapFillMs;

/**
 * A rule whose regular expression does not compile survives the read on purpose: `applyExclusionRules`
 * reports it in `invalidRules` and the settings screen shows it, which is the only way the user can
 * find the typo. Dropping it here would hide a rule they believe is protecting them.
 */
const asRule = (value: unknown): TimetrackExclusionRule | null => {
  const raw = asRecord(value);

  if (raw['kind'] === 'app-id') {
    const appId = asText(raw['appId']);

    return appId ? { kind: 'app-id', appId } : null;
  }

  if (raw['kind'] === 'title-pattern') {
    const pattern = asText(raw['pattern']);

    return pattern ? { kind: 'title-pattern', pattern } : null;
  }

  return null;
};

const asRules = (value: unknown) => (Array.isArray(value) ? value.flatMap((entry) => asRule(entry) ?? []) : []);

/**
 * An attribution rule that names neither a repository nor an application matches nothing, and one that
 * names neither an issue nor a donation has nothing to say, so both are dropped. `createdAt` only
 * orders two equally specific rules, so a document that lost it falls back to the epoch rather than to
 * the whole rule being discarded.
 */
const asAttributionRule = (value: unknown, index: number): AttributionRule | null => {
  const raw = asRecord(value);
  const target = asAttributionTarget(raw['target']);
  const repoPath = asText(raw['repoPath']);
  const appId = asText(raw['appId']);
  const branch = asText(raw['branch']);

  if (!target || (!repoPath && !appId)) return null;

  const createdAt = new Date(typeof raw['createdAt'] === 'number' ? raw['createdAt'] : asText(raw['createdAt']));

  return {
    id: asText(raw['id']) || `rule-${index}`,
    repoPath: repoPath || undefined,
    branch: repoPath && branch ? branch : undefined,
    appId: repoPath ? undefined : appId,
    target,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
  };
};

const asAttributionTarget = (value: unknown): AttributionTarget | null => {
  const raw = asRecord(value);

  if (raw['kind'] === 'donate') return { kind: 'donate' };

  const issueKey = asText(raw['issueKey']);

  return issueKey ? { kind: 'issue', issueKey } : null;
};

const asAttributionRules = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry, index) => asAttributionRule(entry, index) ?? []) : [];

const asProjectLinkTarget = (value: unknown): ProjectLinkTarget | null => {
  const raw = asRecord(value);

  if (raw['kind'] === 'private') return { kind: 'private' };

  const projectKey = asText(raw['projectKey']).toUpperCase();

  return projectKey ? { kind: 'project', projectKey } : null;
};

/**
 * A link with no path matches every repository on the machine, so a document that lost one is dropped
 * rather than read as a statement about everything.
 */
const asProjectLink = (value: unknown, index: number): TimetrackProjectLink | null => {
  const raw = asRecord(value);
  const path = asText(raw['path']);
  const target = asProjectLinkTarget(raw['target']);

  if (!path || !target) return null;

  const createdAt = new Date(typeof raw['createdAt'] === 'number' ? raw['createdAt'] : asText(raw['createdAt']));

  return {
    id: asText(raw['id']) || `link-${index}`,
    path,
    target,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
  };
};

const asProjectLinks = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry, index) => asProjectLink(entry, index) ?? []) : [];

const asNudge = (value: unknown): TimetrackNudgeSettings => {
  const raw = asRecord(value);
  const atMinute = raw['atMinute'];

  return {
    enabled: raw['enabled'] !== false,
    atMinute:
      typeof atMinute === 'number' && Number.isFinite(atMinute)
        ? clampMinuteOfDay(atMinute)
        : DEFAULT_TIMETRACK_SETTINGS.nudge.atMinute,
  };
};

/**
 * The command is read back against the allowlist rather than taken as written. A settings document is
 * a file on disk, and the host would otherwise be asked to spawn whatever a hand-edit put here.
 */
const asReasoning = (value: unknown): TimetrackReasoningSettings => {
  const raw = asRecord(value);
  const command = asText(raw['command']);

  return {
    enabled: raw['enabled'] === true,
    command: REASONING_COMMANDS.includes(command) ? command : DEFAULT_TIMETRACK_SETTINGS.reasoning.command,
    model: asText(raw['model']),
  };
};

const asTextList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(asText).filter((entry) => !!entry))] : [];

/**
 * Reads the picked projects, and reads a document written before they existed: the list used to be
 * bare `issueKeyPrefixes`, which held exactly these keys with no name beside them. Migrating them here
 * rather than asking again keeps the one setting that stops a false issue key from being read.
 */
const asFavoriteProjects = (document: Record<string, unknown>): TimetrackFavoriteProject[] => {
  const stored = document['favoriteProjects'];

  if (Array.isArray(stored)) {
    const found = new Map<string, TimetrackFavoriteProject>();

    for (const entry of stored) {
      const raw = asRecord(entry);
      const key = asText(raw['key']).toUpperCase();

      if (key && !found.has(key)) found.set(key, { key, name: asText(raw['name']) || key });
    }

    return [...found.values()];
  }

  return asTextList(document['issueKeyPrefixes']).map((prefix) => {
    const key = prefix.toUpperCase();

    return { key, name: key };
  });
};

/**
 * The parenting mode is read back against the two the create call can execute. A document naming a
 * third would otherwise reach `createJiraIssue$`, which would then file every ticket with no parent
 * at all and report nothing.
 */
const asTicket = (value: unknown): TimetrackTicketSettings => {
  const raw = asRecord(value);
  const { ticket } = DEFAULT_TIMETRACK_SETTINGS;
  const parentIssueTypeNames = asTextList(raw['parentIssueTypeNames']);

  return {
    issueTypeName: asText(raw['issueTypeName']) || ticket.issueTypeName,
    parentIssueTypeNames: Array.isArray(raw['parentIssueTypeNames'])
      ? parentIssueTypeNames
      : ticket.parentIssueTypeNames,
    parenting: raw['parenting'] === 'issue-link' ? 'issue-link' : 'parent-field',
    parentLinkType: asText(raw['parentLinkType']) || ticket.parentLinkType,
    subjectField: asText(raw['subjectField']),
  };
};

/**
 * Reads a stored settings document, falling back to the default for every field it cannot make sense
 * of. Nothing here throws: a document written by an older version, or one a hand-edit broke, must leave
 * the app usable rather than refusing to start — and the fields it does understand still apply.
 */
export const parseTimetrackSettings = (raw: unknown): TimetrackSettings => {
  const document = asRecord(raw);
  const jira = asRecord(document['jira']);
  const google = asRecord(document['google']);
  const gitlab = asRecord(document['gitlab']);

  return {
    dayTargetMs: asTarget(document['dayTargetMs']),
    gapFillMs: asGapFill(document['gapFillMs']),
    jira: { host: asText(jira['host']), email: asText(jira['email']) },
    google: { clientId: asText(google['clientId']), calendarIds: asTextList(google['calendarIds']) },
    gitlab: { host: asText(gitlab['host']) },
    ticket: asTicket(document['ticket']),
    reasoning: asReasoning(document['reasoning']),
    nudge: asNudge(document['nudge']),
    exclusionRules: asRules(document['exclusionRules']),
    keepDefaultExclusionRules: document['keepDefaultExclusionRules'] !== false,
    gitScanRoots: asTextList(document['gitScanRoots']),
    favoriteProjects: asFavoriteProjects(document),
    meetingIssueKey: asText(document['meetingIssueKey']).toUpperCase(),
    attributionRules: asAttributionRules(document['attributionRules']),
    projectLinks: asProjectLinks(document['projectLinks']),
  };
};
