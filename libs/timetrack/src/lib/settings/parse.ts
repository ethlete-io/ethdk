import { TimetrackExclusionRule } from '../store/exclusion';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings, clampDayTargetMs } from './model';

const asRecord = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asTarget = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampDayTargetMs(value)
    : DEFAULT_TIMETRACK_SETTINGS.dayTargetMs;

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

  return {
    dayTargetMs: asTarget(document['dayTargetMs']),
    jira: { host: asText(jira['host']), email: asText(jira['email']) },
    google: { clientId: asText(google['clientId']), calendarIds: asTextList(google['calendarIds']) },
    exclusionRules: asRules(document['exclusionRules']),
    keepDefaultExclusionRules: document['keepDefaultExclusionRules'] !== false,
    gitScanRoots: asTextList(document['gitScanRoots']),
  };
};
