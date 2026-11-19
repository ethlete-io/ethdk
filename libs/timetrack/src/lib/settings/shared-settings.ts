import { AttributionRule, standInIdOf } from '../model/attribution';
import { CheckoutKeys, translatePeerPath } from '../model/peer-path';
import { CallNaming } from '../model/call-naming';
import { StandIn, StandInRefusal } from '../model/stand-in';
import { TimetrackExclusionRule } from '../store/exclusion';
import {
  PeerStampedEntries,
  changedStamps,
  latestPeerEntries,
  peerEntryWins,
  tombstonesOf,
} from '../review/shared-stamp';
import { SharedStamp } from '../review/model';
import { TimetrackCallRules, TimetrackSettings } from './model';
import { parseAttributionRule, parseCallNaming, parseExclusionRule, parseStandIn, parseStandInRefusal } from './parse';

/**
 * The `day` the settings that travel are stored under beside the day rows. A day key is a date, so this
 * never names a day, and its start lies past any range a day is read with or retention removes.
 */
export const SHARED_SETTINGS_DAY = 'settings';
export const SHARED_SETTINGS_DAY_START_MS = Number.MAX_SAFE_INTEGER - 1;

/** One setting a machine shares with its paired machines, stamped in the sender's clock. */
export type SharedSettingsEntry = { id: string; atMs: number } & (
  | { kind: 'stand-in'; standIn: StandIn }
  | { kind: 'rule'; rule: AttributionRule }
  | { kind: 'refusal'; refusal: StandInRefusal }
  | { kind: 'exclusion'; exclusion: TimetrackExclusionRule }
  | { kind: 'call-rule'; list: CallRuleList; pattern: string }
  | { kind: 'call-naming'; naming: CallNaming }
  | { kind: 'deleted' }
);

type CallRuleList = keyof TimetrackCallRules;

export type PeerSharedSettings = PeerStampedEntries<SharedSettingsEntry>;

type LiveEntry = Exclude<SharedSettingsEntry, { kind: 'deleted' }>;

const RULE = 'rule:';
const STAND_IN = 'stand-in:';
const REFUSAL = 'refusal:';

const refusalIdOf = (refusal: StandInRefusal) =>
  `${REFUSAL}${refusal.repoPath}\n${refusal.branch ?? ''}\n${refusal.workPath ?? ''}`;

const EXCLUSION = 'exclusion:';
const CALL_RULE = 'call-rule:';
const CALL_NAMING = 'call-naming:';

const exclusionIdOf = (rule: TimetrackExclusionRule) =>
  `${EXCLUSION}${rule.kind}:${rule.kind === 'app-id' ? rule.appId : rule.pattern}`;

const callRuleIdOf = (list: CallRuleList, pattern: string) => `${CALL_RULE}${list}:${pattern}`;

const callNamingIdOf = (naming: CallNaming) =>
  `${CALL_NAMING}${[naming.appId, naming.weekday, naming.durationBand, naming.after ?? '', naming.startMinute].join('\n')}`;

const CALL_RULE_LISTS: readonly CallRuleList[] = ['countsAsWork', 'neverCountsAsWork'];

const callNamingOf = (naming: CallNaming): CallNaming => defined({ ...naming });

const refusalOf = (refusal: StandInRefusal): StandInRefusal => defined({ ...refusal });

const sorted = (values: readonly string[] | undefined) => (values?.length ? [...values].sort() : undefined);

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const ruleOf = (rule: AttributionRule): AttributionRule =>
  defined({
    id: rule.id,
    repoPath: rule.repoPath,
    branch: rule.branch,
    workPath: rule.workPath,
    appId: rule.appId,
    target: rule.target.kind === 'stand-in' ? { kind: 'stand-in', standInId: rule.target.standInId } : rule.target,
    author: rule.author,
    createdAt: rule.createdAt,
  });

const standInOf = (standIn: StandIn): StandIn =>
  defined({
    id: standIn.id,
    name: standIn.name,
    description: standIn.description,
    projectKey: standIn.projectKey,
    state: standIn.state,
    issueKey: standIn.issueKey,
    openedFor: standIn.openedFor,
    openedForBranch: standIn.openedForBranch,
    openedForWorkPath: standIn.openedForWorkPath,
    heldOn: sorted(standIn.heldOn),
    resolvedRuleIds: sorted(standIn.resolvedRuleIds),
    resolutionSource: standIn.resolutionSource,
    parentKey: standIn.parentKey,
    parentSource: standIn.parentSource,
    days: [...standIn.days].sort(),
    bookedDays: sorted(standIn.bookedDays),
    hiddenOn: standIn.hiddenOn,
    mergedIds: sorted(standIn.mergedIds),
    author: standIn.author,
    createdAt: standIn.createdAt,
  });

const liveEntriesOf = (settings: TimetrackSettings): Map<string, LiveEntry> =>
  new Map<string, LiveEntry>([
    ...settings.attributionRules.map((rule): [string, LiveEntry] => [
      `${RULE}${rule.id}`,
      { id: `${RULE}${rule.id}`, atMs: 0, kind: 'rule', rule: ruleOf(rule) },
    ]),
    ...settings.standIns.map((standIn): [string, LiveEntry] => [
      `${STAND_IN}${standIn.id}`,
      { id: `${STAND_IN}${standIn.id}`, atMs: 0, kind: 'stand-in', standIn: standInOf(standIn) },
    ]),
    ...settings.exclusionRules.map((exclusion): [string, LiveEntry] => [
      exclusionIdOf(exclusion),
      { id: exclusionIdOf(exclusion), atMs: 0, kind: 'exclusion', exclusion },
    ]),
    ...CALL_RULE_LISTS.flatMap((list) =>
      settings.callRules[list].map((pattern): [string, LiveEntry] => [
        callRuleIdOf(list, pattern),
        { id: callRuleIdOf(list, pattern), atMs: 0, kind: 'call-rule', list, pattern },
      ]),
    ),
    ...settings.callNamings.map((naming): [string, LiveEntry] => [
      callNamingIdOf(naming),
      { id: callNamingIdOf(naming), atMs: 0, kind: 'call-naming', naming: callNamingOf(naming) },
    ]),
    ...settings.noStandInCheckouts.map((refusal): [string, LiveEntry] => [
      refusalIdOf(refusal),
      { id: refusalIdOf(refusal), atMs: 0, kind: 'refusal', refusal: refusalOf(refusal) },
    ]),
  ]);

const wireOf = (entry: SharedSettingsEntry) => {
  switch (entry.kind) {
    case 'rule':
      return { ...entry, rule: { ...entry.rule, createdAt: entry.rule.createdAt.getTime() } };
    case 'stand-in':
      return { ...entry, standIn: { ...entry.standIn, createdAt: entry.standIn.createdAt.getTime() } };
    case 'call-naming':
      return { ...entry, naming: { ...entry.naming, createdAt: entry.naming.createdAt.getTime() } };
    default:
      return entry;
  }
};

const bodyOf = (entry: SharedSettingsEntry) => {
  const { id: _id, atMs: _atMs, ...body } = wireOf(entry);

  return JSON.stringify(body);
};

const bodies = (settings: TimetrackSettings) =>
  new Map([...liveEntriesOf(settings)].map(([id, entry]) => [id, bodyOf(entry)]));

/**
 * `after` with every rule and stand-in that was added, changed or removed since `before` stamped at `atMs`,
 * so a paired machine can tell which side changed it last. Returns `after` when none changed.
 */
export const stampSharedSettings = (options: {
  before: TimetrackSettings;
  after: TimetrackSettings;
  atMs: number;
}): TimetrackSettings => {
  const changed = changedStamps({ was: bodies(options.before), now: bodies(options.after), atMs: options.atMs });

  if (!Object.keys(changed).length) return options.after;

  return { ...options.after, sharedStamps: { ...options.after.sharedStamps, ...changed } };
};

const ABSOLUTE_PATH = /(?:^|[\s@#=]|:(?!\/\/))(?:\/|[A-Za-z]:[\\/]|\\\\)/;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const trimRoot = (root: string) => root.replace(/[\\/]+$/, '') || root;

const replaceRoots = (options: { text: string; keys: CheckoutKeys; replace: (root: string) => string | undefined }) => {
  const { text, keys, replace } = options;
  const roots = Object.keys(keys)
    .map(trimRoot)
    .sort((left, right) => right.length - left.length);

  if (!roots.length) return text;

  let lost = false;
  const replaced = text.replace(new RegExp(`(?:${roots.map(escaped).join('|')})(?=$|[\\\\/@#\\s])`, 'g'), (root) => {
    const next = replace(root);

    if (next === undefined) lost = true;

    return next ?? '';
  });

  return lost ? undefined : replaced;
};

/** Whether `text` names no machine path but the checkouts of `keys`, the only paths a peer can map. */
const holdsOnlyKeyedPaths = (text: string, keys: CheckoutKeys) =>
  !ABSOLUTE_PATH.test(replaceRoots({ text, keys, replace: () => '\0' }) ?? '');

const travels = (texts: readonly (string | undefined)[], keys: CheckoutKeys) =>
  texts.every((text) => text === undefined || holdsOnlyKeyedPaths(text, keys));

const keyedOnly = (ids: readonly string[] | undefined, keys: CheckoutKeys) => {
  const kept = ids?.filter((id) => holdsOnlyKeyedPaths(id, keys));

  return kept?.length ? kept : undefined;
};

const withoutOpenedFor = (standIn: StandIn): StandIn => {
  const { openedFor: _for, openedForBranch: _branch, openedForWorkPath: _workPath, ...rest } = standIn;

  return rest;
};

const outgoingOf = (entry: SharedSettingsEntry, keys: CheckoutKeys): SharedSettingsEntry | null => {
  if (!holdsOnlyKeyedPaths(entry.id, keys)) return null;

  switch (entry.kind) {
    case 'deleted':
      return entry;
    case 'rule': {
      const { rule } = entry;
      const standInId = rule.target.kind === 'stand-in' ? rule.target.standInId : undefined;

      return travels([rule.id, rule.repoPath, standInId], keys) ? entry : null;
    }
    case 'refusal':
      return travels([entry.refusal.repoPath, entry.refusal.workPath], keys) ? entry : null;
    case 'exclusion':
    case 'call-rule':
      return entry;
    case 'call-naming':
      return travels([entry.naming.after, entry.naming.label], keys) ? entry : null;
    case 'stand-in': {
      const { standIn } = entry;
      const placed = travels([standIn.openedFor], keys) ? standIn : withoutOpenedFor(standIn);

      return {
        ...entry,
        standIn: defined({
          ...placed,
          resolvedRuleIds: keyedOnly(placed.resolvedRuleIds, keys),
          mergedIds: keyedOnly(placed.mergedIds, keys),
        }),
      };
    }
  }
};

/**
 * What this machine shares of its settings: its rules and stand-ins and the ones it removed. No credential
 * travels, and no machine path but a checkout of `ownKeys` (ADR 0047 pt 2): a rule or stand-in whose id or
 * repository names another path stays here, and a stand-in opened for one travels without that checkout.
 */
export const sharedSettingsEntriesOf = (options: {
  settings: TimetrackSettings;
  ownKeys: CheckoutKeys;
}): SharedSettingsEntry[] => {
  const live = liveEntriesOf(options.settings);
  const stamps = options.settings.sharedStamps ?? {};

  return [
    ...[...live.values()].map((entry): SharedSettingsEntry => ({ ...entry, atMs: stamps[entry.id]?.atMs ?? 0 })),
    ...tombstonesOf(stamps, live),
  ].flatMap((entry) => outgoingOf(entry, options.ownKeys) ?? []);
};

const SHARED_SETTINGS_VERSION = 1;

/** The wire form of a machine's shared settings, stored as its rows of {@link SHARED_SETTINGS_DAY}. */
export const encodeSharedSettings = (entries: readonly SharedSettingsEntry[]) =>
  JSON.stringify({ sharedSettings: SHARED_SETTINGS_VERSION, entries: entries.map(wireOf) });

const parseEntry = (value: unknown): SharedSettingsEntry | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const { id, atMs } = record;

  if (typeof id !== 'string' || typeof atMs !== 'number') return null;

  switch (record['kind']) {
    case 'deleted':
      return { id, atMs, kind: 'deleted' };
    case 'rule': {
      const rule = parseAttributionRule(record['rule']);

      return rule && id === `${RULE}${rule.id}` ? { id, atMs, kind: 'rule', rule: ruleOf(rule) } : null;
    }
    case 'exclusion': {
      const exclusion = parseExclusionRule(record['exclusion']);

      return exclusion && id === exclusionIdOf(exclusion) ? { id, atMs, kind: 'exclusion', exclusion } : null;
    }
    case 'call-rule': {
      const { list, pattern } = record;

      return (list === 'countsAsWork' || list === 'neverCountsAsWork') &&
        typeof pattern === 'string' &&
        id === callRuleIdOf(list, pattern)
        ? { id, atMs, kind: 'call-rule', list, pattern }
        : null;
    }
    case 'call-naming': {
      const naming = parseCallNaming(record['naming']);

      return naming && id === callNamingIdOf(naming)
        ? { id, atMs, kind: 'call-naming', naming: callNamingOf(naming) }
        : null;
    }
    case 'refusal': {
      const refusal = parseStandInRefusal(record['refusal']);

      return refusal && id === refusalIdOf(refusal) ? { id, atMs, kind: 'refusal', refusal: refusalOf(refusal) } : null;
    }
    case 'stand-in': {
      const standIn = parseStandIn(record['standIn']);

      return standIn && id === `${STAND_IN}${standIn.id}`
        ? { id, atMs, kind: 'stand-in', standIn: standInOf(standIn) }
        : null;
    }
    default:
      return null;
  }
};

/** A paired machine's shared settings read entry by entry, `null` for what no version of this app wrote. */
export const parseSharedSettings = (json: string): SharedSettingsEntry[] | null => {
  try {
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const { sharedSettings, entries } = parsed as Record<string, unknown>;

    if (typeof sharedSettings !== 'number' || !Array.isArray(entries)) return null;

    return entries.map(parseEntry).filter((entry) => entry !== null);
  } catch {
    return null;
  }
};

type Keys = { peerKeys: CheckoutKeys; localKeys: CheckoutKeys };

const localTextOf = (options: Keys & { text: string }) => {
  const { peerKeys, localKeys } = options;
  const local = replaceRoots({
    text: options.text,
    keys: peerKeys,
    replace: (root) => {
      const path = translatePeerPath({ path: root, peerKeys, localKeys });

      return Object.keys(localKeys).map(trimRoot).includes(path) ? path : undefined;
    },
  });

  return local !== undefined && holdsOnlyKeyedPaths(local, localKeys) ? local : undefined;
};

const localTextsOf = (options: Keys & { texts: readonly string[] | undefined }) => {
  const kept = options.texts?.flatMap((text) => localTextOf({ ...options, text }) ?? []);

  return kept?.length ? kept : undefined;
};

const mapEntry = (options: Keys & { entry: SharedSettingsEntry }): SharedSettingsEntry | null => {
  const { entry } = options;
  const id = localTextOf({ ...options, text: entry.id });

  if (id === undefined) return null;

  switch (entry.kind) {
    case 'deleted':
      return { ...entry, id };
    case 'rule': {
      const ruleId = localTextOf({ ...options, text: entry.rule.id });
      const repoPath = entry.rule.repoPath ? localTextOf({ ...options, text: entry.rule.repoPath }) : undefined;

      if (ruleId === undefined || (entry.rule.repoPath && repoPath === undefined)) return null;

      return { ...entry, id, rule: defined({ ...entry.rule, id: ruleId, repoPath }) };
    }
    case 'exclusion': {
      const text = localTextOf({
        ...options,
        text: entry.exclusion.kind === 'app-id' ? entry.exclusion.appId : entry.exclusion.pattern,
      });

      if (text === undefined) return null;

      const exclusion: TimetrackExclusionRule =
        entry.exclusion.kind === 'app-id' ? { kind: 'app-id', appId: text } : { kind: 'title-pattern', pattern: text };

      return { ...entry, id: exclusionIdOf(exclusion), exclusion };
    }
    case 'call-rule': {
      const pattern = localTextOf({ ...options, text: entry.pattern });

      return pattern === undefined ? null : { ...entry, id: callRuleIdOf(entry.list, pattern), pattern };
    }
    case 'call-naming': {
      const after = entry.naming.after ? localTextOf({ ...options, text: entry.naming.after }) : undefined;
      const label = localTextOf({ ...options, text: entry.naming.label });

      if (label === undefined || (entry.naming.after && after === undefined)) return null;

      const naming = callNamingOf({ ...entry.naming, after, label });

      return { ...entry, id: callNamingIdOf(naming), naming };
    }
    case 'refusal': {
      const repoPath = localTextOf({ ...options, text: entry.refusal.repoPath });
      const workPath = entry.refusal.workPath ? localTextOf({ ...options, text: entry.refusal.workPath }) : undefined;

      if (repoPath === undefined || (entry.refusal.workPath && workPath === undefined)) return null;

      const refusal = refusalOf({ ...entry.refusal, repoPath, workPath });

      return { ...entry, id: refusalIdOf(refusal), refusal };
    }
    case 'stand-in': {
      const { standIn } = entry;
      const openedFor = standIn.openedFor ? localTextOf({ ...options, text: standIn.openedFor }) : undefined;
      const placed = openedFor ? { ...standIn, openedFor } : withoutOpenedFor(standIn);

      return {
        ...entry,
        id,
        standIn: defined({
          ...placed,
          resolvedRuleIds: localTextsOf({ ...options, texts: standIn.resolvedRuleIds }),
          mergedIds: localTextsOf({ ...options, texts: standIn.mergedIds }),
        }),
      };
    }
  }
};

/**
 * A paired machine's shared settings with every checkout path moved onto this machine's checkout of the same
 * repository. A rule of a repository this machine has no checkout of is dropped, and a stand-in opened for
 * one loses that checkout.
 */
export const mapSharedSettings = (options: Keys & { entries: readonly SharedSettingsEntry[] }) =>
  options.entries.flatMap((entry) => mapEntry({ ...options, entry }) ?? []);

const union = (left: readonly string[] | undefined, right: readonly string[] | undefined) => {
  const all = [...new Set([...(left ?? []), ...(right ?? [])])].sort();

  return all.length ? all : undefined;
};

const withLocalDays = (standIn: StandIn, local: StandIn | undefined): StandIn =>
  local
    ? defined({ ...standIn, days: union(standIn.days, local.days) ?? [], heldOn: union(standIn.heldOn, local.heldOn) })
    : standIn;

const placeholderKeyOf = (standIn: StandIn) =>
  standIn.state === 'open' && standIn.author === 'app' && standIn.openedFor && standIn.openedForBranch
    ? [standIn.openedFor, standIn.openedForBranch, standIn.openedForWorkPath ?? ''].join('\n')
    : undefined;

const foldStandIn = (into: StandIn, from: StandIn): StandIn =>
  defined({
    ...into,
    days: union(into.days, from.days) ?? [],
    heldOn: union(into.heldOn, from.heldOn),
    mergedIds: union(into.mergedIds, [from.id, ...(from.mergedIds ?? [])]),
    createdAt: from.createdAt < into.createdAt ? from.createdAt : into.createdAt,
  });

/**
 * `settings` with the rules, stand-ins and refusals the paired machines changed later than this machine: the
 * latest stamp wins once each peer's stamp is moved onto this machine's clock (ADR 0041 pt 2), and a tie
 * keeps this machine's version. A stand-in taken from a peer keeps the days this machine drew it on.
 * Open placeholders the app made for one checkout and branch fold into the one with the smallest id, so
 * every machine keeps the same survivor; rows of a folded one still read it through `mergedIds`. Returns
 * `settings` when nothing changed.
 */
export const withPeerSharedSettings = (options: {
  settings: TimetrackSettings;
  peers: readonly PeerSharedSettings[];
}): TimetrackSettings => {
  const { settings } = options;
  const live = liveEntriesOf(settings);
  const stamps = settings.sharedStamps ?? {};
  const changed: Record<string, SharedStamp> = {};
  const rules = new Map(settings.attributionRules.map((rule) => [`${RULE}${rule.id}`, rule]));
  const standIns = new Map(settings.standIns.map((standIn) => [`${STAND_IN}${standIn.id}`, standIn]));
  const refusals = new Map(settings.noStandInCheckouts.map((refusal) => [refusalIdOf(refusal), refusal]));
  const exclusions = new Map(settings.exclusionRules.map((rule) => [exclusionIdOf(rule), rule]));
  const callPatterns = new Map(
    CALL_RULE_LISTS.flatMap((list) =>
      settings.callRules[list].map((pattern): [string, { list: CallRuleList; pattern: string }] => [
        callRuleIdOf(list, pattern),
        { list, pattern },
      ]),
    ),
  );
  const namings = new Map(settings.callNamings.map((naming) => [callNamingIdOf(naming), naming]));
  const latest = latestPeerEntries(options.peers);
  let peerStandInAt = -Infinity;

  for (const [id, entry] of latest) {
    if (entry.kind === 'stand-in') peerStandInAt = Math.max(peerStandInAt, entry.atMs);

    const local = live.get(id);

    if (!peerEntryWins({ entry, held: !!local, stamp: stamps[id] })) continue;

    if (entry.kind === 'deleted') {
      rules.delete(id);
      standIns.delete(id);
      refusals.delete(id);
      exclusions.delete(id);
      callPatterns.delete(id);
      namings.delete(id);
      changed[id] = { atMs: entry.atMs, deleted: true };
      continue;
    }

    if (local && bodyOf(local) === bodyOf(entry)) continue;

    if (entry.kind === 'rule') rules.set(id, entry.rule);
    else if (entry.kind === 'refusal') refusals.set(id, entry.refusal);
    else if (entry.kind === 'exclusion') exclusions.set(id, entry.exclusion);
    else if (entry.kind === 'call-rule') callPatterns.set(id, { list: entry.list, pattern: entry.pattern });
    else if (entry.kind === 'call-naming') namings.set(id, entry.naming);
    else standIns.set(id, withLocalDays(entry.standIn, standIns.get(id)));

    changed[id] = { atMs: entry.atMs };
  }

  if (peerStandInAt > -Infinity) foldPlaceholders({ standIns, rules, stamps, changed, atMs: peerStandInAt });

  if (!Object.keys(changed).length) return settings;

  return {
    ...settings,
    attributionRules: [...rules.values()],
    standIns: [...standIns.values()],
    noStandInCheckouts: [...refusals.values()],
    exclusionRules: [...exclusions.values()],
    callRules: {
      countsAsWork: [...callPatterns.values()]
        .filter((entry) => entry.list === 'countsAsWork')
        .map((entry) => entry.pattern),
      neverCountsAsWork: [...callPatterns.values()]
        .filter((entry) => entry.list === 'neverCountsAsWork')
        .map((entry) => entry.pattern),
    },
    callNamings: [...namings.values()],
    sharedStamps: { ...stamps, ...changed },
  };
};

const foldPlaceholders = (options: {
  standIns: Map<string, StandIn>;
  rules: Map<string, AttributionRule>;
  stamps: Readonly<Record<string, SharedStamp>>;
  changed: Record<string, SharedStamp>;
  atMs: number;
}) => {
  const { standIns, rules, stamps, changed } = options;
  const stampAt = (id: string) => ({ atMs: Math.max(options.atMs, changed[id]?.atMs ?? 0, stamps[id]?.atMs ?? 0) });
  const groups = new Map<string, StandIn[]>();

  for (const standIn of standIns.values()) {
    const key = placeholderKeyOf(standIn);

    if (key) groups.set(key, [...(groups.get(key) ?? []), standIn]);
  }

  const mergedInto = new Map<string, string>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const [keep, ...rest] = [...group].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

    if (!keep) continue;

    standIns.set(`${STAND_IN}${keep.id}`, rest.reduce(foldStandIn, keep));
    changed[`${STAND_IN}${keep.id}`] = stampAt(`${STAND_IN}${keep.id}`);

    for (const from of rest) {
      standIns.delete(`${STAND_IN}${from.id}`);
      changed[`${STAND_IN}${from.id}`] = { ...stampAt(`${STAND_IN}${from.id}`), deleted: true };
      mergedInto.set(from.id, keep.id);
    }
  }

  const liveIds = new Set([...standIns.values()].map((standIn) => standIn.id));

  for (const standIn of standIns.values()) {
    for (const id of standIn.mergedIds ?? []) if (!liveIds.has(id)) mergedInto.set(id, standIn.id);
  }

  for (const [id, rule] of rules) {
    const standInId = standInIdOf(rule);
    const into = standInId === undefined ? undefined : mergedInto.get(standInId);

    if (into === undefined) continue;

    rules.set(id, { ...rule, target: { kind: 'stand-in', standInId: into } });
    changed[id] = stampAt(id);
  }
};
