import { DEFAULT_GIT_FLOW_CONFIG } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { mergeRequestActivity } from './merge-request-activity';

const activity = (overrides: Partial<MergeRequestActivityEvent> = {}): MergeRequestActivityEvent => ({
  at: new Date(2026, 7, 11, 9, 20),
  source: 'gitlab',
  kind: 'merge-request-activity',
  eventId: '9002',
  action: 'commented on',
  mergeRequestIid: '412',
  projectPath: 'braune-digital/app',
  branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
  title: 'Password reset',
  ...overrides,
});

const config = { ...DEFAULT_GIT_FLOW_CONFIG, keyPrefixes: ['FIP'] };

describe('mergeRequestActivity', () => {
  it('names the task under review from the merge request’s own branch', () => {
    const [entry] = mergeRequestActivity({ events: [activity()], config });

    expect(entry).toMatchObject({
      kind: 'merge-request',
      issueKey: 'FIP-2178',
      branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset',
      summary: 'Password reset',
    });
    expect(entry?.detail).toBe(
      'you commented on !412 in braune-digital/app on `sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset`',
    );
  });

  it('says nothing about a merge request whose branch names no issue', () => {
    expect(mergeRequestActivity({ events: [activity({ branch: 'refactor/hub-query-v3' })], config })).toEqual([]);
  });

  it('says nothing while the branch is still unknown', () => {
    expect(mergeRequestActivity({ events: [activity({ branch: undefined })], config })).toEqual([]);
  });

  it('reads only the GitLab events out of a day', () => {
    const events: CollectedEvent[] = [
      { at: new Date(2026, 7, 11, 9, 0), source: 'window', kind: 'window-focus', appId: 'code', title: 'x' },
      activity(),
    ];

    expect(mergeRequestActivity({ events, config })).toHaveLength(1);
  });
});
