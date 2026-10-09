import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { UnnamedContext } from '../model/attribution';
import { CollectedEvent, MergeRequestActivityEvent } from '../model/event';
import { contextWorkFacts, standInWorkFacts } from './work-facts';

const DAY = '2026-10-09';
const at = (clock: string) => new Date(`${DAY}T${clock}:00.000Z`);
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
const REPO = '/home/tom/dev/fut-frontend';
const PROJECT = 'ea/fut-item-platform/fut-item-platform-fe';
const KEYS = { [REPO]: `gitlab.example.com/${PROJECT}` };

const context: UnnamedContext = {
  id: `repo:${REPO}~bug-hunt`,
  context: { repoPath: REPO, branch: 'main', session: 'bug-hunt' },
  observedMs: 5 * 60_000,
  from: at('08:43'),
  to: at('08:48'),
  suggestion: { repoPath: REPO, branch: 'main' },
};

const sample = (
  clock: string,
  options: { workedIn?: string; title?: string; sessionId?: string } = {},
): CollectedEvent => ({
  at: at(clock),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: options.sessionId ?? 'bug-hunt',
  cwd: REPO,
  gitBranch: 'main',
  workedIn: options.workedIn ?? REPO,
  title: options.title ?? 'Find why the order transfer came back on main',
});

const activity = (options: {
  clock: string;
  iid: string;
  title: string;
  branch?: string;
  action?: string;
  description?: string;
}): MergeRequestActivityEvent => ({
  at: at(options.clock),
  source: 'gitlab',
  kind: 'merge-request-activity',
  eventId: `${options.iid}-${options.clock}`,
  action: options.action ?? 'commented on',
  projectPath: PROJECT,
  mergeRequestIid: options.iid,
  branch: options.branch ?? 'feature/disable-game-code-transfer-main',
  title: options.title,
  ...(options.description ? { description: options.description } : {}),
});

const BUG_HUNT = [sample('08:43'), sample('08:45'), sample('08:48')];
const RESTORE = activity({
  clock: '09:21',
  iid: '1095',
  title: 'fix(hub): Restore game code order downloads on main',
  description: 'Reverts the transfer button again, see FIP-3120.',
});

const factsOf = (events: CollectedEvent[]) => contextWorkFacts({ context, events, config: CONFIG, repoKeys: KEYS });

describe('contextWorkFacts', () => {
  it('says per session whether it wrote a file, and keeps its title where it reads as words', () => {
    const facts = factsOf([...BUG_HUNT, sample('08:44', { sessionId: 'other', workedIn: `${REPO}/src/app.ts` })]);

    expect(facts.sessions).toEqual([
      { sessionId: 'bug-hunt', title: 'Find why the order transfer came back on main', wroteFiles: false },
    ]);
  });

  it('drops a title that does not read as words', () => {
    expect(factsOf([sample('08:43', { title: '(click)=' })]).sessions).toEqual([
      { sessionId: 'bug-hunt', wroteFiles: false },
    ]);
  });

  it('counts a shell command that wrote in the checkout as a write', () => {
    const facts = factsOf([...BUG_HUNT, sample('08:46', { workedIn: `${REPO}/` }), RESTORE]);

    expect(facts.sessions[0]?.wroteFiles).toBe(true);
    expect(facts.mergeRequest).toBeUndefined();
  });

  it('hands a stretch that changed nothing the merge request of its checkout, with the issue it names', () => {
    expect(factsOf([...BUG_HUNT, RESTORE]).mergeRequest).toEqual({
      reference: '!1095',
      title: 'fix(hub): Restore game code order downloads on main',
      issueKey: 'FIP-3120',
      action: 'commented on',
      at: at('09:21'),
    });
  });

  it('hands it a merge request that names no issue as well, so auto mode can leave the stretch unnamed', () => {
    const keyless = activity({ clock: '09:21', iid: '1095', title: 'fix(hub): Restore game code order downloads' });

    expect(factsOf([...BUG_HUNT, keyless]).mergeRequest).toMatchObject({ reference: '!1095' });
    expect(factsOf([...BUG_HUNT, keyless]).mergeRequest?.issueKey).toBeUndefined();
  });

  it('takes the merge request whose activity lay nearest the stretch', () => {
    const far = activity({ clock: '15:00', iid: '1090', title: 'feat: Other work', branch: 'feature/FIP-1-other' });

    expect(factsOf([...BUG_HUNT, far, RESTORE]).mergeRequest?.reference).toBe('!1095');
  });

  it('breaks a tie by the words a merge request title shares with the session titles', () => {
    const unrelated = activity({
      clock: '09:21',
      iid: '1001',
      title: 'chore: Bump packages',
      branch: 'chore/FIP-9-bump',
    });
    const related = activity({
      clock: '09:21',
      iid: '1002',
      title: 'Order transfer on main',
      branch: 'fix/FIP-7-order',
    });

    expect(factsOf([...BUG_HUNT, unrelated, related]).mergeRequest?.reference).toBe('!1002');
  });

  it('reads a merge request of another checkout as no answer', () => {
    const elsewhere = { ...RESTORE, projectPath: 'ea/other/other-fe' };

    expect(factsOf([...BUG_HUNT, elsewhere]).mergeRequest).toBeUndefined();
  });

  it('matches a checkout without a remote key by its directory name', () => {
    const named = { ...RESTORE, projectPath: 'group/fut-frontend' };

    expect(contextWorkFacts({ context, events: [...BUG_HUNT, named], config: CONFIG }).mergeRequest).toBeDefined();
  });

  it('hands nothing where a commit landed in the checkout while the stretch ran', () => {
    const commit: CollectedEvent = {
      at: at('08:47'),
      source: 'git',
      kind: 'git-commit',
      repoPath: REPO,
      branch: 'main',
      sha: 'abc1234',
      subject: 'fix: Restore downloads',
    };

    expect(factsOf([...BUG_HUNT, commit, RESTORE]).mergeRequest).toBeUndefined();
  });

  it('hands one where the checkout only pulled while the stretch ran', () => {
    const pull: CollectedEvent = {
      at: at('08:44'),
      source: 'git',
      kind: 'git-branch-update',
      repoPath: REPO,
      branch: 'main',
      action: 'pull --tags origin main: Fast-forward',
    };

    expect(factsOf([...BUG_HUNT, pull, RESTORE]).mergeRequest?.reference).toBe('!1095');
  });

  it('hands nothing where the user pushed to a merge request of the checkout while the stretch ran', () => {
    const push = activity({ clock: '08:46', iid: '1095', title: RESTORE.title ?? '', action: 'pushed to' });

    expect(factsOf([...BUG_HUNT, push, RESTORE]).mergeRequest).toBeUndefined();
  });
});

describe('standInWorkFacts', () => {
  it("reads a stand-in's bands of the day as its stretch", () => {
    const facts = standInWorkFacts({
      standIn: { id: 's1', openedFor: REPO },
      bands: [
        { standInId: 's1', from: at('08:30'), to: at('09:00') },
        { standInId: 's2', from: at('09:00'), to: at('10:00') },
      ],
      events: [...BUG_HUNT, RESTORE],
      config: CONFIG,
      repoKeys: KEYS,
    });

    expect(facts.mergeRequest?.issueKey).toBe('FIP-3120');
  });
});
