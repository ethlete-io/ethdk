import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { WorkGroup } from '../correlate/merge';
import { UnnamedContext } from '../correlate/rules';
import { ActivityBlock, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { draftTicket } from './draft';

const REPO = '/Users/tom/dev/ea-frontend';
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const evidence = (kind: Evidence['kind'], detail: string, summary?: string): Evidence => ({
  kind,
  at: new Date('2026-08-16T09:30:00Z'),
  detail,
  summary,
});

const block = (context: ActivityBlock['context'], entries: Evidence[] = []): ActivityBlock => ({
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T10:00:00Z'),
  context,
  evidence: entries,
});

const group = (blocks: ActivityBlock[]): WorkGroup => ({
  from: blocks[0]?.from ?? new Date(0),
  to: blocks[blocks.length - 1]?.to ?? new Date(0),
  observedMs: 0,
  confidence: 'weak',
  evidence: [],
  blocks,
});

const unnamed = (context: UnnamedContext['context'], observedMs = 135 * 60_000): UnnamedContext => ({
  id: contextKey(context),
  context,
  observedMs,
  from: new Date('2026-08-16T09:00:00Z'),
  to: new Date('2026-08-16T11:15:00Z'),
  suggestion: { repoPath: context.repoPath, branch: context.branch, appId: context.appId },
});

const draft = (options: { context: UnnamedContext['context']; entries?: Evidence[] }) => {
  const context = unnamed(options.context);

  return draftTicket({
    context,
    unattributed: [group([block(options.context, options.entries ?? [])])],
    config: CONFIG,
  });
};

describe('draftTicket', () => {
  it('reads the summary out of the branch, which is what the user called the work', () => {
    const drafted = draft({ context: { repoPath: REPO, branch: 'feat/user-management-screen' } });

    expect(drafted.summary).toBe('User management screen');
    expect(drafted.subject).toBe('user-management-screen');
  });

  it('falls back to the strongest observation when the branch says nothing', () => {
    const drafted = draft({
      context: { repoPath: REPO, branch: 'next' },
      entries: [evidence('commit', '4 commits', 'Rework the invite flow')],
    });

    expect(drafted.summary).toBe('Rework the invite flow');
  });

  it('falls back to the repository, so a draft always has a summary', () => {
    expect(draft({ context: { repoPath: REPO, branch: 'next' } }).summary).toBe('ea-frontend');
    expect(draft({ context: { appId: 'com.figma.Desktop' } }).summary).toBe('com.figma.Desktop');
  });

  it('says where the time came from, and says it last', () => {
    const drafted = draft({ context: { repoPath: REPO, branch: 'feat/user-management' } });

    expect(drafted.description).toContain(
      'Recorded from 2h 15m of work in ea-frontend, on branch feat/user-management.',
    );
    expect(drafted.description.split('\n').at(-1)).toContain('Recorded from');
  });

  it('quotes commit and agent-session wording, never a window title', () => {
    const drafted = draft({
      context: { repoPath: REPO, branch: 'feat/user-management' },
      entries: [
        evidence('commit', '4 commits', 'feat(admin): Add the user list'),
        evidence('agent-session', 'session', 'Wire the invite endpoint'),
        evidence('window-title', 'Salary review 2026 — Numbers'),
      ],
    });

    expect(drafted.notes).toEqual(['feat(admin): Add the user list', 'Wire the invite endpoint']);
    expect(drafted.description).toContain('- feat(admin): Add the user list');
    expect(drafted.description).not.toContain('Salary review');
  });

  it('leads with the work rather than with where the time came from', () => {
    const drafted = draft({
      context: { repoPath: REPO, branch: 'feat/user-management' },
      entries: [evidence('commit', '4 commits', 'feat(admin): Add the user list')],
    });

    expect(drafted.description.split('\n')[0]).toBe('What the work says it was:');
  });

  it('quotes no more notes than it was allowed', () => {
    const context = { repoPath: REPO, branch: 'feat/user-management' };
    const entries = Array.from({ length: 8 }, (_, index) => evidence('commit', `commit ${index}`, `Subject ${index}`));
    const drafted = draftTicket({
      context: unnamed(context),
      unattributed: [group([block(context, entries)])],
      config: CONFIG,
      maxNotes: 3,
    });

    expect(drafted.notes).toHaveLength(3);
  });

  it('ignores evidence from another context', () => {
    const context = { repoPath: REPO, branch: 'feat/user-management' };
    const other = { repoPath: '/Users/tom/dev/other', branch: 'next' };
    const drafted = draftTicket({
      context: unnamed(context),
      unattributed: [group([block(other, [evidence('commit', 'x', 'Not this work')])])],
      config: CONFIG,
    });

    expect(drafted.notes).toEqual([]);
  });
});
