import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { AUTO_MODE_CLIENT } from '../agent-api/action-classes';
import { AgentApproval, enqueueApproval } from '../agent-api/approval-queue';
import { UnnamedContext } from '../model/attribution';
import { ActivityBlock, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { WorkGroup } from '../rows/merge';
import { WorkFacts } from '../ticket/work-facts';
import { ticketWritingSpec } from '../ticket/write';
import { autoModeMergeRequestOutcome, withUnnamedSubjectItemsExpired } from './auto-merge-request';
import {
  autoModeApprovalTarget,
  autoModeAsks,
  autoModeKeyInEvidence,
  autoModeSubjectKey,
  autoModeSubjectRequest,
} from './auto-mode';
import { AutoModeAnswer, AutoModeSubject } from './model';

const TODAY = '2026-10-09';
const at = (clock: string) => new Date(`${TODAY}T${clock}:00Z`);
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
const ON_MAIN = { repoPath: '/home/tom/dev/fut-frontend', branch: 'main', session: 'bug-hunt' };
const TITLE = 'Find why the order transfer came back on main';

const note: Evidence = { kind: 'agent-session', at: at('08:43'), detail: TITLE, summary: TITLE };
const block: ActivityBlock = { from: at('08:43'), to: at('08:48'), context: ON_MAIN, evidence: [note] };
const GROUP: WorkGroup = {
  from: at('08:43'),
  to: at('08:48'),
  observedMs: 300_000,
  confidence: 'weak',
  evidence: [],
  blocks: [block],
};
const CONTEXT: UnnamedContext = {
  id: contextKey(ON_MAIN),
  context: ON_MAIN,
  observedMs: 300_000,
  from: at('08:43'),
  to: at('08:48'),
  suggestion: ON_MAIN,
};
const SUBJECT: AutoModeSubject = { kind: 'context', contextId: CONTEXT.id };

const MERGE_REQUEST = {
  reference: '!1095',
  title: 'fix(hub): Restore game code order downloads on main',
  action: 'commented on',
  at: at('09:21'),
};
const facts = (issueKey?: string): WorkFacts => ({
  sessions: [{ sessionId: 'bug-hunt', title: TITLE, wroteFiles: false }],
  mergeRequest: { ...MERGE_REQUEST, ...(issueKey ? { issueKey } : {}) },
});
const factsMap = (value: WorkFacts) => new Map([[autoModeSubjectKey(SUBJECT), value]]);

const requestWith = (workFacts?: ReadonlyMap<string, WorkFacts>) => {
  const request = autoModeSubjectRequest({
    subject: SUBJECT,
    contexts: [CONTEXT],
    unattributed: [GROUP],
    standIns: [],
    config: CONFIG,
    maskedNames: [],
    workFacts,
  });

  if (!request) throw new Error('autoModeSubjectRequest built no request');

  return request;
};

const asks = (options: { workFacts?: ReadonlyMap<string, WorkFacts>; answers?: AutoModeAnswer[] }) =>
  autoModeAsks({
    enabled: true,
    day: TODAY,
    today: TODAY,
    nowMs: at('12:00').getTime(),
    contexts: [CONTEXT],
    standIns: [],
    rows: [],
    answers: options.answers ?? [],
    evidence: { unattributed: [GROUP], config: CONFIG, maskedNames: [], workFacts: options.workFacts },
    approvals: [],
  });

describe('auto mode on a stretch whose agent sessions changed nothing', () => {
  it('tells the model per session whether it wrote a file, and keeps the merge request to itself', () => {
    const request = requestWith(factsMap(facts('FIP-3120')));
    const sent = JSON.parse(ticketWritingSpec({ request }).stdin ?? '{}') as Record<string, unknown>;

    expect(request.sessions).toEqual([{ title: TITLE, wroteFiles: false }]);
    expect(sent['sessions']).toEqual([{ title: TITLE, wroteFiles: false }]);
    expect(sent['mergeRequest']).toBeUndefined();
  });

  it('names the stretch with the issue the merge request names, as evidence', () => {
    const request = requestWith(factsMap(facts('FIP-3120')));

    expect(autoModeMergeRequestOutcome(facts('FIP-3120'))).toMatchObject({ kind: 'match', issueKey: 'FIP-3120' });
    expect(autoModeKeyInEvidence({ request, issueKey: 'FIP-3120' })).toBe(true);
  });

  it('never answers by itself for a stretch that wrote a file', () => {
    expect(autoModeMergeRequestOutcome({ sessions: [{ sessionId: 'x', wroteFiles: true }] })).toBeNull();
  });

  it('asks nothing about a stretch whose merge request names no issue', () => {
    expect(asks({ workFacts: factsMap(facts()) })).toEqual([]);
    expect(asks({ workFacts: factsMap(facts('FIP-3120')) })).toEqual([SUBJECT]);
  });

  it('asks again once a merge request turns up after a draft was answered', () => {
    const draft: AutoModeAnswer = {
      subject: SUBJECT,
      askedAtMs: at('11:00').getTime(),
      request: requestWith(),
      outcome: { kind: 'draft', summary: 'Restore the downloads', description: '' },
    };

    expect(asks({ answers: [draft] })).toEqual([]);
    expect(asks({ answers: [draft], workFacts: factsMap(facts('FIP-3120')) })).toEqual([SUBJECT]);
  });

  it('withdraws what it queued for a stretch it now leaves unnamed', () => {
    const queue = enqueueApproval([], {
      id: 'create',
      request: { op: 'jira.create', summary: 'Click-Handler anpassen', description: '', projectKey: 'FIP' },
      client: AUTO_MODE_CLIENT,
      target: autoModeApprovalTarget(TODAY, SUBJECT),
      at: at('09:00'),
      day: TODAY,
    });
    const states = (value: WorkFacts) =>
      withUnnamedSubjectItemsExpired(queue, { day: TODAY, workFacts: factsMap(value) }).map(
        (item: AgentApproval) => item.state,
      );

    expect(states(facts())).toEqual(['expired']);
    expect(states(facts('FIP-3120'))).toEqual(['queued']);
  });
});
