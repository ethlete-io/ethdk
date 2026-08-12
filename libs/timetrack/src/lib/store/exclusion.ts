import { CollectedEvent, CollectedEventSource } from '../model/event';

/**
 * A deny rule, evaluated before an event is persisted. `app-id` matches a window's application id
 * exactly, case-insensitively; `title-pattern` is a case-insensitive regular expression tested against
 * any event that carries a title — a window, an agent session, or a calendar entry.
 */
export type TimetrackExclusionRule = { kind: 'app-id'; appId: string } | { kind: 'title-pattern'; pattern: string };

/**
 * A starting set covering the cases that make the app uninstallable if they leak: password managers,
 * private-browsing windows and online banking. Meant to be shown and edited in settings, not treated
 * as sufficient — the host composes the user's rules with these itself.
 */
export const DEFAULT_EXCLUSION_RULES: TimetrackExclusionRule[] = [
  { kind: 'app-id', appId: 'org.keepassxc.KeePassXC' },
  { kind: 'app-id', appId: 'com.bitwarden.desktop' },
  { kind: 'app-id', appId: '1Password' },
  { kind: 'app-id', appId: 'org.gnome.World.Secrets' },
  { kind: 'app-id', appId: 'org.gnome.Seahorse' },
  { kind: 'title-pattern', pattern: 'private browsing' },
  { kind: 'title-pattern', pattern: 'incognito' },
  { kind: 'title-pattern', pattern: 'onlinebanking|online banking' },
];

/** What an excluded event was. It deliberately carries no title and no app id — that is the point. */
export type ExcludedEventSummary = {
  at: Date;
  source: CollectedEventSource;
  kind: CollectedEvent['kind'];
  rule: TimetrackExclusionRule;
};

export type ExclusionResult = {
  kept: CollectedEvent[];
  excluded: ExcludedEventSummary[];
  /** Rules whose pattern does not compile. They matched nothing; surface them in settings. */
  invalidRules: { rule: TimetrackExclusionRule; error: string }[];
};

type CompiledRule = { rule: TimetrackExclusionRule; appId?: string; title?: RegExp };

const titleOf = (event: CollectedEvent) =>
  'title' in event && typeof event.title === 'string' ? event.title : undefined;

const appIdOf = (event: CollectedEvent) => ('appId' in event ? event.appId : undefined);

/** The compiled pattern, or the reason it does not compile. */
const compiledPattern = (pattern: string): RegExp | string => {
  try {
    return new RegExp(pattern, 'i');
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Why a rule can never match anything, or `null` when it is sound. A settings screen can reject a typo
 * with this before it is stored, rather than leaving the user with a rule that protects nothing.
 */
export const exclusionRuleError = (rule: TimetrackExclusionRule): string | null => {
  if (rule.kind === 'app-id') return rule.appId.trim() ? null : 'An app id cannot be empty.';

  const compiled = compiledPattern(rule.pattern);

  return typeof compiled === 'string' ? compiled : null;
};

const compile = (rules: TimetrackExclusionRule[]) => {
  const compiled: CompiledRule[] = [];
  const invalidRules: ExclusionResult['invalidRules'] = [];

  for (const rule of rules) {
    if (rule.kind === 'app-id') {
      compiled.push({ rule, appId: rule.appId.toLowerCase() });
      continue;
    }

    const pattern = compiledPattern(rule.pattern);

    if (typeof pattern === 'string') {
      invalidRules.push({ rule, error: pattern });
      continue;
    }

    compiled.push({ rule, title: pattern });
  }

  return { compiled, invalidRules };
};

const matching = (compiled: CompiledRule[], event: CollectedEvent) => {
  const appId = appIdOf(event)?.toLowerCase();
  const title = titleOf(event);

  return compiled.find((entry) =>
    entry.title ? title !== undefined && entry.title.test(title) : appId !== undefined && entry.appId === appId,
  )?.rule;
};

/**
 * Splits events into the ones that may be persisted and a summary of the ones a rule denied. Run this
 * before the store is touched: an excluded window title must never reach the database, which is why
 * the summary keeps only the timestamp, the source and the rule that fired.
 *
 * A rule with an uncompilable pattern is reported rather than thrown, and matches nothing — a typo in
 * settings must not be able to stop collection. Check `invalidRules` and show them, or the user will
 * believe a rule is protecting them when it is not.
 */
export const applyExclusionRules = (options: {
  events: CollectedEvent[];
  rules: TimetrackExclusionRule[];
}): ExclusionResult => {
  const { compiled, invalidRules } = compile(options.rules);
  const result: ExclusionResult = { kept: [], excluded: [], invalidRules };

  for (const event of options.events) {
    const rule = matching(compiled, event);

    if (rule) {
      result.excluded.push({ at: event.at, source: event.source, kind: event.kind, rule });
      continue;
    }

    result.kept.push(event);
  }

  return result;
};
