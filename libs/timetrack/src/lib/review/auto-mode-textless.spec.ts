import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { AUTO_MODE_CLIENT } from '../agent-api/action-classes';
import { AgentApproval, enqueueApproval } from '../agent-api/approval-queue';
import { UnnamedContext } from '../model/attribution';
import { ActivityBlock, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { openStandIn } from '../model/stand-in';
import { WorkGroup } from '../rows/merge';
import {
  autoModeApplyTarget,
  autoModeApprovalTarget,
  autoModeAsks,
  withTextlessSubjectItemsExpired,
} from './auto-mode';
import { AutoModeSubject } from './model';

const TODAY = '2026-08-11';
const at = (time: string) => new Date(`${TODAY}T${time}:00Z`);
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ABC'] });
const REPO = '/work/shop';
const ON_MAIN = { repoPath: REPO, branch: 'main' };

const note = (summary: string): Evidence => ({ kind: 'agent-session', at: at('08:30'), detail: summary, summary });

const groupWith = (notes: string[]): WorkGroup => {
  const block: ActivityBlock = { from: at('08:00'), to: at('08:30'), context: ON_MAIN, evidence: notes.map(note) };

  return { from: at('08:00'), to: at('08:30'), observedMs: 480_000, confidence: 'weak', evidence: [], blocks: [block] };
};

const CONTEXT: UnnamedContext = {
  id: contextKey(ON_MAIN),
  context: ON_MAIN,
  observedMs: 480_000,
  from: at('08:00'),
  to: at('08:30'),
  suggestion: ON_MAIN,
};

const STAND_IN = openStandIn({
  name: 'shop',
  description: 'Nothing in the day names this work beyond where it happened.',
  day: TODAY,
  now: at('08:30'),
  author: 'app',
  openedFor: REPO,
  openedForBranch: 'main',
});

const bandWith = (notes: string[]) => ({
  standInId: STAND_IN.id,
  observedMs: 480_000,
  to: at('08:30'),
  evidence: notes.map(note),
});

describe('auto mode on work whose only text does not read as words', () => {
  const asks = (notes: string[]) =>
    autoModeAsks({
      enabled: true,
      day: TODAY,
      today: TODAY,
      nowMs: at('12:00').getTime(),
      contexts: [],
      standIns: [STAND_IN],
      rows: [bandWith(notes)],
      answers: [],
      evidence: { unattributed: [groupWith(notes)], config: CONFIG, maskedNames: [] },
      approvals: [],
    });

  it('asks nothing about a stand-in the app named after where the work happened', () => {
    expect(asks(['(click)='])).toEqual([]);
    expect(asks(['Bind the click event in the hub'])).toEqual([{ kind: 'stand-in', standInId: STAND_IN.id }]);
  });

  it('withdraws what it proposed for such a stand-in or context, and leaves a readable one waiting', () => {
    const subjects: AutoModeSubject[] = [
      { kind: 'stand-in', standInId: STAND_IN.id },
      { kind: 'context', contextId: CONTEXT.id },
    ];
    const queue = subjects.reduce<AgentApproval[]>(
      (items, subject, index) =>
        enqueueApproval(
          enqueueApproval(items, {
            id: `create-${index}`,
            request: { op: 'jira.create', summary: 'Click-Handler anpassen', description: '', projectKey: 'ABC' },
            client: AUTO_MODE_CLIENT,
            target: autoModeApprovalTarget(TODAY, subject),
            at: at('09:36'),
            day: TODAY,
          }),
          {
            id: `apply-${index}`,
            request: { op: 'autoMode.apply', day: TODAY, subject, label: 'shop', issueKey: 'ABC-1' },
            client: AUTO_MODE_CLIENT,
            target: autoModeApplyTarget(TODAY, subject),
            at: at('09:36'),
            day: TODAY,
          },
        ),
      [],
    );
    const states = (notes: string[]) =>
      withTextlessSubjectItemsExpired(queue, {
        day: TODAY,
        contexts: [CONTEXT],
        standIns: [STAND_IN],
        bands: [bandWith(notes)],
        unattributed: [groupWith(notes)],
        config: CONFIG,
      }).map((item) => item.state);

    expect(states(['(click)='])).toEqual(['expired', 'expired', 'expired', 'expired']);
    expect(states(['Bind the click event in the hub'])).toEqual(['queued', 'queued', 'queued', 'queued']);
  });
});
