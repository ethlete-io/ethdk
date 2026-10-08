import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { openStandIn } from '../model/stand-in';
import { unnamedContexts } from '../rows/rules';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from '../settings/model';
import { streamDay } from '../stream/stream-day';
import { anonymousDayReport } from './anonymous-report';
import { reviewDay } from './review-day';
import { EMPTY_DAY_REVIEW_EDITS } from './model';

const CLIENT_REPO = '/home/jane.doe/dev/acme-portal';
const OTHER_REPO = '/home/jane.doe/dev/globex-shop';
const BRANCH = 'feature/ACME-4711-reset-password-mail';
const AT = (minutes: number) => new Date(Date.UTC(2026, 8, 23, 8, 0, 0) + minutes * 60_000);

const LEAKS = [
  'jane',
  'acme',
  'globex',
  '4711',
  'reset-password',
  'password',
  'invoice',
  'john smith',
  'quarterly',
  'https://',
  'example.com',
  '/home/',
  'src/billing',
  'billing',
  '@',
  'ACME-',
  'GLX-',
  'mail.ts',
  'secret-session',
];

const focus = (from: number, to: number, title: string, appId = 'code'): CollectedEvent[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    at: AT(from + index),
    source: 'window',
    kind: 'window-focus',
    appId,
    title,
  }));

const OBSERVED: CollectedEvent[] = [
  ...focus(0, 60, 'mail.ts - acme-portal - Visual Studio Code'),
  ...focus(61, 90, 'Invoice for Jane Doe - https://billing.example.com/acme', 'chrome-acme.example.com__Default'),
  ...focus(91, 150, 'globex-shop – cart.component.ts', 'jetbrains-webstorm'),
  {
    at: AT(30),
    source: 'git',
    kind: 'git-commit',
    repoPath: CLIENT_REPO,
    branch: BRANCH,
    sha: 'abc123',
    subject: 'fix(billing): Send the Acme invoice to jane.doe@acme.com',
    paths: ['src/billing/mail.ts'],
  },
  {
    at: AT(40),
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: 'vscode',
    repoPath: CLIENT_REPO,
    branch: BRANCH,
    directory: 'src/billing',
    editing: true,
  },
  {
    at: AT(45),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: 'secret-session-1',
    cwd: `${CLIENT_REPO}/src/billing`,
    gitBranch: BRANCH,
    title: 'Fix the Acme password reset mail for John Smith',
  },
  {
    at: AT(100),
    source: 'calendar',
    kind: 'calendar-event',
    occurrenceId: 'occ-1',
    until: AT(130),
    title: 'Quarterly review with John Smith (Acme)',
    accepted: true,
    conferenceUrl: 'https://meet.example.com/acme-review',
    participants: ['john.smith@acme.com'],
  },
];

const EVENTS = [...OBSERVED].sort((a, b) => a.at.getTime() - b.at.getTime());

const LINKS: TimetrackProjectLink[] = [
  { id: 'link-acme', path: CLIENT_REPO, target: { kind: 'project', projectKey: 'ACME' }, createdAt: AT(0) },
  { id: 'link-globex', path: OTHER_REPO, target: { kind: 'project', projectKey: 'GLX' }, createdAt: AT(0) },
];

const STAND_IN = openStandIn({
  name: 'Acme password reset mail for Jane',
  description: 'Sends the Acme invoice to jane.doe@acme.com',
  day: '2026-09-23',
  now: AT(0),
  projectKey: 'ACME',
  author: 'app',
  openedFor: CLIENT_REPO,
  openedForBranch: BRANCH,
  key: 'acme-portal-feature-ACME-4711-reset-password-mail',
});

const SETTINGS: TimetrackSettings = {
  ...DEFAULT_TIMETRACK_SETTINGS,
  projectLinks: LINKS,
  gitScanRoots: ['/home/jane.doe/dev'],
  reasoning: {
    ...DEFAULT_TIMETRACK_SETTINGS.reasoning,
    enabled: true,
    autoMode: true,
    command: '/home/jane.doe/.local/bin/claude',
    maskedNames: ['Acme', 'Globex'],
  },
  attributionRules: [
    {
      id: 'rule-acme',
      repoPath: OTHER_REPO,
      branch: 'feature/GLX-12-cart-for-acme',
      target: { kind: 'issue', issueKey: 'GLX-12' },
      author: 'user',
      createdAt: AT(0),
    },
    {
      id: 'rule-stand-in',
      repoPath: CLIENT_REPO,
      branch: BRANCH,
      target: { kind: 'stand-in', standInId: STAND_IN.id },
      author: 'app',
      createdAt: AT(0),
    },
    {
      id: 'rule-app',
      appId: 'chrome-acme.example.com__Default',
      target: { kind: 'issue', issueKey: 'ACME-1' },
      author: 'user',
      createdAt: AT(0),
    },
  ],
  standIns: [STAND_IN],
};

const reportOf = (focusRowId?: string) => {
  const stream = streamDay({
    events: EVENTS,
    options: { repoRoots: [CLIENT_REPO, OTHER_REPO], links: LINKS, baseBranches: ['main', 'develop'] },
  });
  const contexts = unnamedContexts({ unattributed: stream.rows.unattributed });
  const rows = reviewDay({
    rows: stream.rows,
    edits: EMPTY_DAY_REVIEW_EDITS,
    standIns: SETTINGS.standIns,
    rules: SETTINGS.attributionRules,
  }).rows;

  return anonymousDayReport({
    day: '2026-09-23',
    today: '2026-09-23',
    screenDay: '2026-09-22',
    generatedAt: AT(240),
    ...(focusRowId ? { focusRowId } : {}),
    flags: { windowLocked: false, tempoHistory: 'ready', epicsSettled: true, discoveryAnswered: true },
    settings: SETTINGS,
    links: LINKS,
    repoRoots: [CLIENT_REPO, OTHER_REPO],
    stream,
    contexts,
    rows,
    offeredCheckouts: [OTHER_REPO],
    answers: contexts.slice(0, 1).map((context) => ({
      subject: { kind: 'context', contextId: context.id },
      askedAtMs: AT(200).getTime(),
      request: { notes: ['Acme invoice for jane.doe@acme.com'], repo: 'acme-portal', branch: BRANCH } as never,
      outcome: { kind: 'draft', summary: 'Acme password reset', description: 'For Jane', projectKey: 'ACME' },
    })),
    approvals: [],
    activity: [
      { day: '2026-09-23', state: 'failed', startedAtMs: AT(200).getTime(), error: 'spawn /home/jane.doe/claude' },
    ],
  });
};

describe('anonymousDayReport', () => {
  it('lets no name, key, title, path, URL or address through', () => {
    const report = reportOf(`ACME-4711@${AT(0).toISOString()}`);
    const text = JSON.stringify(report).toLowerCase();

    for (const raw of LEAKS) expect(text, raw).not.toContain(raw.toLowerCase());
  });

  it('keeps one placeholder per name, so the sections still refer to each other', () => {
    const report = reportOf();
    const checkouts = new Set(report.streams.flatMap((stream) => (stream.checkout ? [stream.checkout] : [])));

    expect([...checkouts].sort()).toEqual(['checkout-1', 'checkout-2']);
    expect(report.links.map((link) => link.path).sort()).toEqual(['checkout-1', 'checkout-2']);
    expect(report.standIns[0]?.checkout).toBe(report.links.find((link) => link.project === 'project-1')?.path);
  });

  it('says what the stand-in pass and auto mode decided', () => {
    const report = reportOf();

    expect(report.standInPass.length).toBeGreaterThan(0);
    expect(report.standInPass.every((decision) => typeof decision.verdict === 'string')).toBe(true);
    expect(report.autoMode.some((entry) => entry.outcome === 'draft')).toBe(true);
    expect(report.flags.autoModeRuns).toBe(true);
    expect(report.screenShowsDay).toBe(false);
    expect(report.settings.reasoning.command).toBe('custom');
  });
});
