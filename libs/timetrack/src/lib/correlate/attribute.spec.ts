import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { attribute } from './attribute';

const block = (context: ActivityBlock['context'], evidence: ActivityBlock['evidence'] = []): ActivityBlock => ({
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  context,
  evidence,
});

const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

describe('attribute', () => {
  it('is certain about a conforming main feature branch', () => {
    const result = attribute({ block: block({ branch: 'feat/FIP-2177-user-management' }), config: FIP });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.storyKey).toBe('FIP-2177');
    expect(result.confidence).toBe('certain');
  });

  it('logs a sub-feature against the task and keeps the story for roll-up', () => {
    const result = attribute({
      block: block({ branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset' }),
      config: FIP,
    });

    expect(result.issueKey).toBe('FIP-2178');
    expect(result.storyKey).toBe('FIP-2177');
    expect(result.taskKey).toBe('FIP-2178');
    expect(result.confidence).toBe('certain');
  });

  it('drops to likely when the branch names a key but does not conform', () => {
    const result = attribute({ block: block({ branch: 'feature/FIP-2177-user-management' }), config: FIP });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('likely');
  });

  it('inherits the story through the base branch and says so in the evidence', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: FIP,
      resolveBase: () => 'feat/FIP-2177-user-management',
    });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.map((entry) => entry.kind)).toContain('inherited-branch');
  });

  it('falls back to a key in a window title, weakly', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: '[FIP-2222] Button not visible - Jira' },
      ]),
      config: FIP,
    });

    expect(result.issueKey).toBe('FIP-2222');
    expect(result.confidence).toBe('weak');
  });

  it('ignores a title key from another project when keyPrefixes is set', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: 'ABC-99 something else' },
      ]),
      config: FIP,
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('leaves a block with no key at all unattributed rather than guessing', () => {
    const result = attribute({ block: block({ appId: 'slack' }), config: FIP });

    expect(result.issueKey).toBeUndefined();
    expect(result.confidence).toBe('weak');
  });

  it('does not attribute a keyless branch when nothing resolves its base', () => {
    const result = attribute({ block: block({ branch: 'fix/logout-confirmation' }), config: FIP });

    expect(result.issueKey).toBeUndefined();
  });
});
