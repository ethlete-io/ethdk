import { describe, expect, it } from 'vitest';
import { WorkGroup } from '../rows/merge';
import { UnnamedContext } from '../model/attribution';
import { ActivityBlock, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { WorklogProposal } from '../model/proposal';
import { LoggedIssue } from '../model/recurrence';
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

  it('quotes commit and agent-session evidence but never a window title or a meeting title', () => {
    const context = { repoPath: REPO, branch: 'refactor/hub-query-v3' };
    const blocks = [
      block(context, [
        evidence('commit', '17 commits', 'refactor(hub): Replace the query v2 client'),
        evidence('agent-session', 'session', 'Port the hub query client'),
        evidence('window-title', 'Q3 redundancies — final.xlsx'),
        evidence('calendar', 'Kickoff with Contoso', 'Kickoff with Contoso'),
      ]),
    ];

    const { request } = reasoningPlan({ contexts: [unnamed(context)], unattributed: [group(blocks)] });

    expect(request.contexts[0]?.notes).toEqual([
      'refactor(hub): Replace the query v2 client',
      'Port the hub query client',
    ]);
    expect(JSON.stringify(request)).not.toContain('redundancies');
    expect(JSON.stringify(request)).not.toContain('Contoso');
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
  const proposal = (issueKey: string, description: string) => ({ issueKey, description }) as unknown as WorklogProposal;

  const logged = (issueKey: string, summary = 'from tempo'): LoggedIssue => ({ issueKey, summary });

  it('offers each issue the day already reached once', () => {
    expect(
      reasoningCandidates({
        proposals: [proposal('FIP-2177', 'Club pack'), proposal('FIP-2177', 'Club pack again')],
      }),
    ).toEqual([{ issueKey: 'FIP-2177', summary: 'Club pack' }]);
  });

  it('offers what the history logged after what the day reached', () => {
    expect(
      reasoningCandidates({
        proposals: [proposal('FIP-2177', 'Club pack')],
        logged: [logged('ET-772', 'Collector')],
      }),
    ).toEqual([
      { issueKey: 'FIP-2177', summary: 'Club pack' },
      { issueKey: 'ET-772', summary: 'Collector' },
    ]);
  });

  it("keeps the day's own description for an issue the history names too", () => {
    expect(
      reasoningCandidates({ proposals: [proposal('FIP-2177', 'Club pack')], logged: [logged('FIP-2177')] }),
    ).toEqual([{ issueKey: 'FIP-2177', summary: 'Club pack' }]);
  });

  it("cuts the history at the cap and never the day's own issues", () => {
    const candidates = reasoningCandidates({
      proposals: [proposal('FIP-1', 'One'), proposal('FIP-2', 'Two')],
      logged: [logged('ET-1'), logged('ET-2'), logged('ET-3')],
      limit: 3,
    });

    expect(candidates.map((candidate) => candidate.issueKey)).toEqual(['FIP-1', 'FIP-2', 'ET-1']);
  });

  it('offers every issue the day reached even past the cap, because a day names what it names', () => {
    const candidates = reasoningCandidates({
      proposals: [proposal('FIP-1', 'One'), proposal('FIP-2', 'Two'), proposal('FIP-3', 'Three')],
      logged: [logged('ET-1')],
      limit: 2,
    });

    expect(candidates.map((candidate) => candidate.issueKey)).toEqual(['FIP-1', 'FIP-2', 'FIP-3']);
  });
});
