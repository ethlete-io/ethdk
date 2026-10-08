import { stripRefPrefix } from '@ethlete/agent-rules/git-flow';
import { autoModeActs } from '../agent-api/action-classes';
import { AgentApproval } from '../agent-api/approval-queue';
import { UnnamedContext, matchAttributionRule } from '../model/attribution';
import { TimetrackProjectLink } from '../model/project-link';
import { TimetrackSettings } from '../settings/model';
import { gitFlowConfigFor } from '../settings/attribution';
import { StreamDay } from '../stream/stream-day';
import { autoStandInDecisions } from '../ticket/auto-stand-in';
import { autoModeAsks, autoModeSettledAt, autoModeSubjectKey, autoModeTargetOf } from './auto-mode';
import { AutoModeAnswer, AutoModeSubject, ReviewedRow } from './model';

/** The reads the stand-in pass and auto mode wait for, as the app saw them when the report was copied. */
export type AnonymousReportFlags = {
  windowLocked: boolean;
  tempoHistory: 'loading' | 'no-token' | 'ready' | 'failed';
  epicsSettled: boolean;
  discoveryAnswered: boolean;
};

export type AnonymousReportInput = {
  day: string;
  today: string;
  /** The day the review screen shows, which the on-screen passes run for. */
  screenDay: string;
  generatedAt: Date;
  /** Whether every name is replaced by a placeholder. Defaults to `true`. */
  anonymize?: boolean;
  /** The raw day inputs the agent `day.inputs` op returns, carried as written. They hold names, so they belong in a report that is not anonymized. */
  inputs?: unknown;
  /** The row the report was copied from, when it was copied from one. */
  focusRowId?: string;
  flags: AnonymousReportFlags;
  settings: TimetrackSettings;
  links: readonly TimetrackProjectLink[];
  repoRoots: readonly string[] | null | undefined;
  stream: StreamDay | null;
  contexts: readonly UnnamedContext[];
  rows: readonly ReviewedRow[];
  offeredCheckouts: readonly string[];
  answers: readonly AutoModeAnswer[];
  approvals: readonly Pick<AgentApproval, 'id' | 'request' | 'target' | 'state' | 'result' | 'error'>[];
  activity: readonly { day: string; state: string; startedAtMs: number; endedAtMs?: number; error?: string }[];
};

const KNOWN_COMMANDS = new Set(['claude', 'codex']);
const SIMPLE_NAME = /^[a-z0-9][a-z0-9.\-_]*$/i;

/**
 * Hands out a stable placeholder per kind and raw value, so the report keeps its structure readable
 * while every name in it stays on the machine.
 */
const placeholders = () => {
  const held = new Map<string, Map<string, string>>();

  return (kind: string, raw: string | undefined) => {
    if (raw === undefined || raw === '') return undefined;

    const ofKind = held.get(kind) ?? new Map<string, string>();
    const found = ofKind.get(raw);

    held.set(kind, ofKind);

    if (found) return found;

    const name = `${kind}-${ofKind.size + 1}`;

    ofKind.set(raw, name);

    return name;
  };
};

const iso = (date: Date | undefined) => date?.toISOString();

const countBy = <T>(entries: readonly T[], keyOf: (entry: T) => string) =>
  entries.reduce<Record<string, number>>((all, entry) => {
    const key = keyOf(entry);

    return { ...all, [key]: (all[key] ?? 0) + 1 };
  }, {});

/**
 * Everything the stand-in pass and auto mode decided a day on, with every name replaced by a
 * placeholder: no client, ticket key, summary, window title, URL, path, calendar title, person or
 * email leaves in it. Only numbers, instants, the app's own enum values and placeholders do.
 */
export const anonymousDayReport = (input: AnonymousReportInput) => {
  const anonymous = input.anonymize !== false;
  const name = anonymous ? placeholders() : (_kind: string, raw: string | undefined) => raw || undefined;
  const { settings, day } = input;
  const config = gitFlowConfigFor(settings);
  const baseBranches = new Set(
    [config.baseBranches.development, config.baseBranches.production].map((branch) => stripRefPrefix(branch)),
  );
  const repo = (path: string | undefined) => name('checkout', path);
  const branch = (raw: string | undefined) => {
    const stripped = stripRefPrefix(raw ?? '');

    return stripped ? { name: name('branch', stripped), base: baseBranches.has(stripped) } : undefined;
  };
  const app = (raw: string | undefined) => name('app', raw);
  const issue = (raw: string | undefined) => name('issue', raw?.toUpperCase());
  const standIn = (raw: string | undefined) => name('stand-in', raw);
  const context = (raw: string | undefined) => name('context', raw);
  const subjectName = (subject: AutoModeSubject) =>
    subject.kind === 'context' ? context(subject.contextId) : standIn(subject.standInId);

  const enabled =
    settings.reasoning.enabled &&
    settings.reasoning.autoMode &&
    autoModeActs(settings.actionClasses) &&
    !input.flags.windowLocked;
  const ruled = new Set(
    input.contexts
      .filter((entry) => matchAttributionRule({ context: entry.context, rules: settings.attributionRules }))
      .map((entry) => entry.id),
  );
  const unattributed = input.stream?.rows.unattributed ?? [];
  const nowMs = input.generatedAt.getTime();
  const asking = new Set(
    autoModeAsks({
      enabled,
      day,
      today: input.today,
      nowMs,
      contexts: input.contexts,
      ruledContextIds: ruled,
      standIns: settings.standIns,
      rows: input.rows,
      answers: input.answers,
      evidence: { unattributed, config, maskedNames: settings.reasoning.maskedNames },
      approvals: input.approvals,
    }).map(autoModeSubjectKey),
  );
  const settledAt = autoModeSettledAt({ contexts: input.contexts, rows: input.rows, unattributed });
  const answers = new Map(input.answers.map((answer) => [autoModeSubjectKey(answer.subject), answer]));
  const subjects: AutoModeSubject[] = [
    ...input.contexts.map((entry): AutoModeSubject => ({ kind: 'context', contextId: entry.id })),
    ...settings.standIns
      .filter((entry) => entry.state === 'open' && entry.days.includes(day))
      .map((entry): AutoModeSubject => ({ kind: 'stand-in', standInId: entry.id })),
  ];
  const autoModeStatus = (subject: AutoModeSubject) => {
    const key = autoModeSubjectKey(subject);

    if (!enabled) return 'off';
    if (day !== input.today) return 'not-today';
    if (subject.kind === 'context' && ruled.has(subject.contextId)) return 'ruled';
    if (asking.has(key)) return 'asks-now';
    if (answers.has(key)) return 'answered';
    if (settledAt(subject) > nowMs) return 'settling';

    return 'left-to-the-user';
  };

  return {
    format: anonymous ? 'timetrack-anonymous-report/1' : 'timetrack-debug-report/1',
    anonymous,
    generatedAt: iso(input.generatedAt),
    day,
    isToday: day === input.today,
    screenShowsDay: input.screenDay === day,
    ...(input.focusRowId ? { focusRow: name('row', input.focusRowId) } : {}),
    flags: {
      ...input.flags,
      reasoningEnabled: settings.reasoning.enabled,
      autoMode: settings.reasoning.autoMode,
      autoModeActs: autoModeActs(settings.actionClasses),
      autoModeRuns: enabled,
    },
    settings: {
      dayStartHour: settings.dayStartHour,
      reasoning: {
        command: KNOWN_COMMANDS.has(settings.reasoning.command) ? settings.reasoning.command : 'custom',
        model: SIMPLE_NAME.test(settings.reasoning.model)
          ? settings.reasoning.model
          : settings.reasoning.model
            ? 'custom'
            : '',
        maskedNames: settings.reasoning.maskedNames.length,
      },
      actionClasses: settings.actionClasses,
      baseBranches: [...baseBranches].map((entry) => branch(entry)),
      gitScanRoots: settings.gitScanRoots.length,
    },
    repoRoots: input.repoRoots ? input.repoRoots.length : null,
    links: input.links.map((link) => ({
      path: repo(link.path),
      kind: link.target.kind,
      ...(link.target.kind === 'project' ? { project: name('project', link.target.projectKey) } : {}),
    })),
    rules: settings.attributionRules.map((rule) => ({
      ...(rule.repoPath ? { checkout: repo(rule.repoPath) } : {}),
      ...(rule.branch ? { branch: branch(rule.branch) } : {}),
      ...(rule.workPath ? { workPath: name('path', rule.workPath) } : {}),
      ...(rule.appId ? { app: app(rule.appId) } : {}),
      target: rule.target.kind,
      ...(rule.target.kind === 'issue' ? { issue: issue(rule.target.issueKey) } : {}),
      ...(rule.target.kind === 'stand-in' ? { standIn: standIn(rule.target.standInId) } : {}),
      author: rule.author,
    })),
    standIns: settings.standIns.map((entry) => ({
      id: standIn(entry.id),
      state: entry.state,
      author: entry.author,
      ...(entry.projectKey ? { project: name('project', entry.projectKey) } : {}),
      ...(entry.openedFor ? { checkout: repo(entry.openedFor) } : {}),
      ...(entry.openedForBranch ? { branch: branch(entry.openedForBranch) } : {}),
      ...(entry.openedForWorkPath ? { workPath: name('path', entry.openedForWorkPath) } : {}),
      days: entry.days.length,
      holdsThisDay: entry.days.includes(day),
      ...(entry.resolutionSource ? { resolutionSource: entry.resolutionSource } : {}),
    })),
    refusedStandIns: settings.noStandInCheckouts.length,
    offeredCheckouts: input.offeredCheckouts.map((entry) => repo(entry)),
    totals: input.stream
      ? {
          presenceMs: input.stream.presenceMs,
          engagedMs: input.stream.engagedMs,
          focusMs: input.stream.focusMs,
          breakMs: input.stream.breakMs,
          unattendedMs: input.stream.unattendedMs,
          rebuiltMs: input.stream.rebuiltMs,
        }
      : null,
    streams: (input.stream?.streams ?? []).map((stream) => ({
      checkout: repo(stream.repoPath),
      branches: stream.branches.map((entry) => branch(entry)),
      apps: stream.apps.map((entry) => app(entry)),
      engagedMs: stream.engagedMs,
      unattendedMs: stream.unattendedMs,
      rebuiltMs: stream.rebuiltMs,
      agentSessions: stream.agentSessions,
      neverFocused: stream.neverFocused,
      evidence: countBy(stream.evidence, (entry) => entry.kind),
    })),
    unnamedFocus: (input.stream?.unnamedFocus ?? []).map((entry) => ({
      app: app(entry.appId),
      reason: entry.reason,
      ms: entry.ms,
      titles: entry.titles.length,
    })),
    unnamed: input.contexts.map((entry) => ({
      context: context(entry.id),
      ...(entry.context.repoPath ? { checkout: repo(entry.context.repoPath) } : {}),
      ...(entry.context.branch ? { branch: branch(entry.context.branch) } : {}),
      ...(entry.context.workPath ? { workPath: name('path', entry.context.workPath) } : {}),
      ...(entry.context.session ? { session: name('session', entry.context.session) } : {}),
      ...(entry.context.appId ? { app: app(entry.context.appId) } : {}),
      observedMs: entry.observedMs,
      from: iso(entry.from),
      to: iso(entry.to),
      ruled: ruled.has(entry.id),
    })),
    standInPass: autoStandInDecisions({
      contexts: input.contexts,
      links: input.links,
      rules: settings.attributionRules,
      config,
      repoRoots: input.repoRoots,
      offeredCheckouts: input.offeredCheckouts,
      standIns: settings.standIns,
      refused: settings.noStandInCheckouts,
    }).map((decision) => ({
      ...(decision.repoPath ? { checkout: repo(decision.repoPath) } : {}),
      ...(decision.branch ? { branch: branch(decision.branch) } : {}),
      ...(decision.workPath ? { workPath: name('path', decision.workPath) } : {}),
      ...(decision.appId ? { app: app(decision.appId) } : {}),
      observedMs: decision.observedMs,
      verdict: decision.verdict,
    })),
    autoMode: subjects.map((subject) => {
      const answer = answers.get(autoModeSubjectKey(subject));
      const settles = settledAt(subject);

      return {
        kind: subject.kind,
        subject: subjectName(subject),
        status: autoModeStatus(subject),
        ...(Number.isFinite(settles) ? { settlesAt: iso(new Date(settles)) } : {}),
        ...(answer ? { answeredAt: iso(new Date(answer.askedAtMs)), outcome: answer.outcome.kind } : {}),
      };
    }),
    rows: input.rows.map((row) => ({
      id: name('row', row.id),
      from: iso(row.from),
      to: iso(row.to),
      durationMs: row.durationMs,
      observedMs: row.observedMs,
      ...(row.laneKey ? { lane: name('lane', row.laneKey) } : {}),
      ...(row.issueKey ? { issue: issue(row.issueKey) } : {}),
      ...(row.standInId ? { standIn: standIn(row.standInId) } : {}),
      ...(row.withheldIssueKey ? { withheldIssue: issue(row.withheldIssueKey) } : {}),
      state: row.state,
      confidence: row.confidence,
      unattended: !!row.unattended,
      hidden: row.hidden,
      excluded: !!row.excluded,
      edited: row.edited,
      ...(row.sources ? { sources: row.sources } : {}),
      evidence: countBy(row.evidence, (entry) => entry.kind),
    })),
    approvals: input.approvals
      .filter((entry) => autoModeTargetOf(entry.target)?.day === day)
      .map((entry) => ({ op: entry.request.op, state: entry.state })),
    activity: input.activity
      .filter((entry) => entry.day === day)
      .map((entry) => ({
        state: entry.state,
        startedAt: iso(new Date(entry.startedAtMs)),
        ...(entry.endedAtMs ? { tookMs: entry.endedAtMs - entry.startedAtMs } : {}),
        failed: !!entry.error,
      })),
    ...(input.inputs !== undefined ? { inputs: input.inputs } : {}),
  };
};

export type AnonymousDayReport = ReturnType<typeof anonymousDayReport>;
