import { ProjectLinkTarget, TimetrackProjectLink } from '../model/project-link';
import { AttributionRule, AttributionTarget, NamedTarget, NamingAuthor } from '../model/attribution';
import { StandIn } from '../model/stand-in';
import { CallNaming } from '../model/call-naming';
import { MeetingNaming } from '../model/meeting-naming';
import { REASONING_COMMANDS } from '../reason/model';
import { TimetrackExclusionRule } from '../store/exclusion';
import {
  DEFAULT_TIMETRACK_SETTINGS,
  TimetrackCallRules,
  TimetrackFavoriteProject,
  TimetrackNudgeSettings,
  TimetrackStandInSettings,
  TimetrackReasoningSettings,
  TimetrackSettings,
  TimetrackTicketSettings,
  clampDayTargetMs,
  clampDayStartHour,
  clampEpicChildLimit,
  clampGapFillMs,
  clampLockAfterIdleMs,
  clampMinuteOfDay,
  clampStandInOverdueMs,
  clampStandInOverdueWorkdays,
} from './model';
import { withoutOrphanedStandIns } from './stand-in';

const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * A document written before the agent could prepare a naming holds no author, and every record in it
 * is one the user wrote by hand. Reading the absence as `user` is therefore the fact, not a default.
 */
const asAuthor = (value: unknown): NamingAuthor => (value === 'agent' || value === 'app' ? value : 'user');

const asDate = (value: unknown) => {
  const at = new Date(typeof value === 'number' ? value : asText(value));

  return Number.isNaN(at.getTime()) ? new Date(0) : at;
};

const asWholeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;

const asTarget = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampDayTargetMs(value)
    : DEFAULT_TIMETRACK_SETTINGS.dayTargetMs;

const asGapFill = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? clampGapFillMs(value) : DEFAULT_TIMETRACK_SETTINGS.gapFillMs;

const asEpicChildLimit = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampEpicChildLimit(value)
    : DEFAULT_TIMETRACK_SETTINGS.epicChildLimit;

const asDayStartHour = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampDayStartHour(value)
    : DEFAULT_TIMETRACK_SETTINGS.dayStartHour;

const asLockAfterIdle = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampLockAfterIdleMs(value)
    : DEFAULT_TIMETRACK_SETTINGS.lockAfterIdleMs;

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

  return {
    id: asText(raw['id']) || `rule-${index}`,
    repoPath: repoPath || undefined,
    branch: repoPath && branch ? branch : undefined,
    appId: repoPath ? undefined : appId,
    target,
    author: asAuthor(raw['author']),
    createdAt: asDate(raw['createdAt']),
  };
};

const asIssueTarget = (value: unknown): NamedTarget | null => {
  const issueKey = asText(value).toUpperCase();

  return issueKey ? { kind: 'issue', issueKey } : null;
};

const asNamedTarget = (value: unknown): NamedTarget | null => {
  const raw = asRecord(value);

  if (raw['kind'] === 'stand-in') {
    const standInId = asText(raw['standInId']);

    return standInId ? { kind: 'stand-in', standInId } : null;
  }

  return asIssueTarget(raw['issueKey']);
};

const asAttributionTarget = (value: unknown): AttributionTarget | null =>
  asRecord(value)['kind'] === 'donate' ? { kind: 'donate' } : asNamedTarget(value);

/**
 * A stand-in with no name is dropped: the name is the whole of what it is, and a band labelled with
 * an empty string would read as one the app failed to name rather than one the user is waiting on.
 *
 * A record that says `resolved` without an issue is read back as open. A resolved stand-in with no key
 * would be one the card offers neither to resolve nor to undo.
 */
const asStandIn = (value: unknown, index: number): StandIn | null => {
  const raw = asRecord(value);
  const name = asText(raw['name']);

  if (!name) return null;

  const issueKey = asText(raw['issueKey']).toUpperCase();
  const projectKey = asText(raw['projectKey']).toUpperCase();

  const resolvedRuleIds = asTextList(raw['resolvedRuleIds']);

  return {
    id: asText(raw['id']) || `stand-in-${index}`,
    name,
    description: asText(raw['description']) || undefined,
    projectKey: projectKey || undefined,
    state: raw['state'] === 'resolved' && issueKey ? 'resolved' : 'open',
    issueKey: issueKey || undefined,
    openedFor: asText(raw['openedFor']) || undefined,
    /** Without it a resolve read back from disk has nothing to point back, so the undo puts back nothing. */
    resolvedRuleIds: resolvedRuleIds.length ? resolvedRuleIds : undefined,
    days: asTextList(raw['days']).sort(),
    author: asAuthor(raw['author']),
    createdAt: asDate(raw['createdAt']),
  };
};

const asStandIns = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry, index) => asStandIn(entry, index) ?? []) : [];

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

/**
 * A naming with no series key or no issue is dropped rather than read as an answer about every
 * meeting, which is the shape the removed standing meeting issue had.
 */
const asMeetingNaming = (value: unknown): MeetingNaming | null => {
  const raw = asRecord(value);
  const seriesKey = asText(raw['seriesKey']);
  const issueKey = asText(raw['issueKey']).toUpperCase();

  if (!seriesKey || !issueKey) return null;

  const createdAt = new Date(typeof raw['createdAt'] === 'number' ? raw['createdAt'] : asText(raw['createdAt']));

  return {
    seriesKey,
    issueKey,
    title: asText(raw['title']),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
  };
};

const asMeetingNamings = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry) => asMeetingNaming(entry) ?? []) : [];

/**
 * A call naming with no application or no target is dropped: the application is the gate
 * `matchCallNaming` reads first, and a record without one would name a call in any product at all.
 *
 * A bare `issueKey` is read as an issue target. Every record written before a call could name a
 * stand-in has that shape, and the store is the user's own answers rather than a cache.
 */
const asCallNaming = (value: unknown): CallNaming | null => {
  const raw = asRecord(value);
  const appId = asText(raw['appId']).toLowerCase();
  const target = raw['target'] === undefined ? asIssueTarget(raw['issueKey']) : asNamedTarget(raw['target']);

  if (!appId || !target) return null;

  const createdAt = new Date(typeof raw['createdAt'] === 'number' ? raw['createdAt'] : asText(raw['createdAt']));
  const after = asText(raw['after']);

  return {
    appId,
    weekday: asWholeNumber(raw['weekday']) ?? 0,
    durationBand: asText(raw['durationBand']),
    ...(after ? { after } : {}),
    startMinute: asWholeNumber(raw['startMinute']) ?? 0,
    target,
    label: asText(raw['label']),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date(0) : createdAt,
  };
};

const asCallNamings = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((entry) => asCallNaming(entry) ?? []) : [];

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

const asStandInSettings = (value: unknown): TimetrackStandInSettings => {
  const raw = asRecord(value);
  const workdays = asWholeNumber(raw['overdueAfterWorkdays']);
  const held = asWholeNumber(raw['overdueAfterMs']);

  return {
    overdueAfterWorkdays:
      workdays === undefined
        ? DEFAULT_TIMETRACK_SETTINGS.standIn.overdueAfterWorkdays
        : clampStandInOverdueWorkdays(workdays),
    overdueAfterMs:
      held === undefined ? DEFAULT_TIMETRACK_SETTINGS.standIn.overdueAfterMs : clampStandInOverdueMs(held),
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
    language: asText(raw['language']),
    maskedNames: asTextList(raw['maskedNames']),
  };
};

const asTextList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(asText).filter((entry) => !!entry))] : [];

/**
 * A pattern that does not compile survives the read, for the same reason an exclusion rule does: the
 * settings screen is the only place the user can find the typo, and `classifyCalls` already treats an
 * unreadable pattern as matching nothing.
 */
const asCallRules = (value: unknown): TimetrackCallRules => {
  const raw = asRecord(value);

  return {
    countsAsWork: asTextList(raw['countsAsWork']),
    neverCountsAsWork: asTextList(raw['neverCountsAsWork']),
  };
};

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
/**
 * Reads the stored document back, and sweeps the placeholders it holds that nothing names any more.
 *
 * The sweep is here rather than at a call site because a dead placeholder is a property of the
 * document, and every screen that reads the document would otherwise have to know about it.
 */
export const parseTimetrackSettings = (raw: unknown): TimetrackSettings =>
  withoutOrphanedStandIns(readTimetrackSettings(raw));

const readTimetrackSettings = (raw: unknown): TimetrackSettings => {
  const document = asRecord(raw);
  const jira = asRecord(document['jira']);
  const google = asRecord(document['google']);
  const gitlab = asRecord(document['gitlab']);
  const github = asRecord(document['github']);

  return {
    dayTargetMs: asTarget(document['dayTargetMs']),
    gapFillMs: asGapFill(document['gapFillMs']),
    dayStartHour: asDayStartHour(document['dayStartHour']),
    epicChildLimit: asEpicChildLimit(document['epicChildLimit']),
    jira: { host: asText(jira['host']), email: asText(jira['email']) },
    google: { clientId: asText(google['clientId']), calendarIds: asTextList(google['calendarIds']) },
    gitlab: { host: asText(gitlab['host']) },
    github: { enabled: github['enabled'] === true },
    ticket: asTicket(document['ticket']),
    reasoning: asReasoning(document['reasoning']),
    nudge: asNudge(document['nudge']),
    standIn: asStandInSettings(document['standIn']),
    exclusionRules: asRules(document['exclusionRules']),
    callRules: asCallRules(document['callRules']),
    noWorkContextApps: asTextList(document['noWorkContextApps']),
    holdsWorkApps: asTextList(document['holdsWorkApps']),
    keepDefaultExclusionRules: document['keepDefaultExclusionRules'] !== false,
    gitScanRoots: asTextList(document['gitScanRoots']),
    favoriteProjects: asFavoriteProjects(document),
    backgroundProjects: asTextList(document['backgroundProjects']).map((key) => key.toUpperCase()),
    meetingNamings: asMeetingNamings(document['meetingNamings']),
    callNamings: asCallNamings(document['callNamings']),
    attributionRules: asAttributionRules(document['attributionRules']),
    projectLinks: asProjectLinks(document['projectLinks']),
    standIns: asStandIns(document['standIns']),
    noStandInCheckouts: asTextList(document['noStandInCheckouts']),
    lockWindow: document['lockWindow'] !== false,
    lockAfterIdleMs: asLockAfterIdle(document['lockAfterIdleMs']),
  };
};
