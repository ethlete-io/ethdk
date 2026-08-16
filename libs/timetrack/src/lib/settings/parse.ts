import { AttributionRule, AttributionTarget } from '../correlate/rules';
import { TimetrackExclusionRule } from '../store/exclusion';
import {
  DEFAULT_TIMETRACK_SETTINGS,
  TimetrackNudgeSettings,
  TimetrackSettings,
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

const asTextList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(asText).filter((entry) => !!entry))] : [];

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
    nudge: asNudge(document['nudge']),
    exclusionRules: asRules(document['exclusionRules']),
    keepDefaultExclusionRules: document['keepDefaultExclusionRules'] !== false,
    gitScanRoots: asTextList(document['gitScanRoots']),
    issueKeyPrefixes: asTextList(document['issueKeyPrefixes']).map((prefix) => prefix.toUpperCase()),
    attributionRules: asAttributionRules(document['attributionRules']),
  };
};
