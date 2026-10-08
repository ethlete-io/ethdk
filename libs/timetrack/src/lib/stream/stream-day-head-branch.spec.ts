import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { unnamedContexts } from '../rows/rules';
import { autoStandIns } from '../ticket/auto-stand-in';
import { streamDay } from './stream-day';

const REPO = '/home/you/dev/app-a';
const AT = (minutes: number) => new Date(Date.UTC(2026, 8, 23, 8, 0, 0) + minutes * 60_000);
const LINK: TimetrackProjectLink = {
  id: 'link',
  path: REPO,
  target: { kind: 'project', projectKey: 'APA' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const focus = (from: number, to: number): CollectedEvent[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    at: AT(from + index),
    source: 'window',
    kind: 'window-focus',
    appId: 'jetbrains-webstorm',
    title: 'app-a – upload.component.ts',
  }));

const standInsOf = (headBranches?: Record<string, string>) => {
  const day = streamDay({
    events: focus(0, 120),
    options: {
      repoRoots: [REPO],
      links: [LINK],
      baseBranches: ['main', 'develop'],
      ...(headBranches ? { headBranches } : {}),
    },
  });

  return autoStandIns({
    contexts: unnamedContexts({ unattributed: day.rows.unattributed }),
    unattributed: day.rows.unattributed,
    links: [LINK],
    rules: [],
    config: resolveGitFlowConfig({ keyPrefixes: ['APA'] }),
    repoRoots: [REPO],
    offeredCheckouts: [],
    standIns: [],
    refused: [],
    day: '2026-09-23',
    now: AT(130),
  });
};

describe('a checkout the day names no branch for', () => {
  it('opens no stand-in while nothing names the branch', () => {
    expect(standInsOf()).toEqual([]);
  });

  it('opens one on the branch the reflog says the checkout was on', () => {
    expect(standInsOf({ [REPO]: 'feature/upload' }).map((opened) => opened.rule.branch)).toEqual(['feature/upload']);
  });
});
