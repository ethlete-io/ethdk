import { describe, expect, it } from 'vitest';
import { WorkGroup } from '../correlate/merge';
import { UnnamedContext } from '../correlate/rules';
import { ActivityBlock, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { reasoningCandidates, reasoningPlan } from './payload';

const REPO = '/Users/tom/dev/ea-frontend';

const block = (context: ActivityBlock['context'], evidence: Evidence[] = []): ActivityBlock => ({
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T10:00:00Z'),
  context,
  evidence,
});

const group = (blocks: ActivityBlock[]): WorkGroup => ({
  from: blocks[0]?.from ?? new Date(0),
  to: blocks[blocks.length - 1]?.to ?? new Date(0),
  observedMs: 0,
  confidence: 'weak',
  evidence: [],
  blocks,
});

const unnamed = (context: UnnamedContext['context'], observedMs = 90 * 60_000): UnnamedContext => ({
  id: contextKey(context),
  context,
  observedMs,
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T10:30:00Z'),
  suggestion: { repoPath: context.repoPath, branch: context.branch, appId: context.appId },
});

const evidence = (kind: Evidence['kind'], detail: string, summary?: string): Evidence => ({
  kind,
  at: new Date('2026-08-16T09:30:00Z'),
  detail,
  summary,
});

describe('reasoningPlan', () => {
  it('sends the repository name and never its path', () => {
    const context = { repoPath: REPO, branch: 'refactor/hub-query-v3' };
    const { request, contextIds } = reasoningPlan({ contexts: [unnamed(context)], unattributed: [] });

    expect(request.contexts).toEqual([
      { id: 'c1', repo: 'ea-frontend', branch: 'refactor/hub-query-v3', app: undefined, minutes: 90, notes: [] },
    ]);
    expect(JSON.stringify(request)).not.toContain('/Users/tom');
    expect(contextIds['c1']).toBe(contextKey(context));
  });

  it('quotes commit and agent-session evidence but never a window title', () => {
    const context = { repoPath: REPO, branch: 'refactor/hub-query-v3' };
    const blocks = [
      block(context, [
        evidence('commit', '17 commits', 'refactor(hub): Replace the query v2 client'),
        evidence('agent-session', 'session', 'Port the hub query client'),
        evidence('window-title', 'Q3 redundancies — final.xlsx'),
      ]),
    ];

    const { request } = reasoningPlan({ contexts: [unnamed(context)], unattributed: [group(blocks)] });

    expect(request.contexts[0]?.notes).toEqual([
      'refactor(hub): Replace the query v2 client',
      'Port the hub query client',
    ]);
    expect(JSON.stringify(request)).not.toContain('redundancies');
  });

  it('leaves out a context too short to be worth asking about', () => {
    const context = { appId: 'com.tinyspeck.slackmacgap' };
    const { request } = reasoningPlan({ contexts: [unnamed(context, 60_000)], unattributed: [] });

    expect(request.contexts).toEqual([]);
  });

  it('hashes the payload, so an unchanged day does not spawn the CLI again', () => {
    const context = { repoPath: REPO, branch: 'refactor/hub-query-v3' };
    const first = reasoningPlan({ contexts: [unnamed(context)], unattributed: [] });
    const same = reasoningPlan({ contexts: [unnamed(context)], unattributed: [] });
    const longer = reasoningPlan({ contexts: [unnamed(context, 120 * 60_000)], unattributed: [] });

    expect(same.hash).toBe(first.hash);
    expect(longer.hash).not.toBe(first.hash);
  });
});

describe('reasoningCandidates', () => {
  it('offers each issue the day already reached once', () => {
    const proposal = (issueKey: string, description: string) =>
      ({ issueKey, description }) as unknown as WorklogProposal;

    expect(
      reasoningCandidates({
        proposals: [proposal('FIP-2177', 'Club pack'), proposal('FIP-2177', 'Club pack again')],
      }),
    ).toEqual([{ issueKey: 'FIP-2177', summary: 'Club pack' }]);
  });
});
