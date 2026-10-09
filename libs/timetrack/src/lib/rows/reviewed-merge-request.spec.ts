import { describe, expect, it } from 'vitest';
import { DEFAULT_GIT_FLOW_CONFIG } from '@ethlete/agent-rules/git-flow';
import { ActivityBlock } from '../model/block';
import { CollectedEvent, MergeRequestActivityEvent, MergeRequestChangesEvent } from '../model/event';
import { buildRows } from './build-rows';
import { directoryLabel } from './describe';

const config = { ...DEFAULT_GIT_FLOW_CONFIG, keyPrefixes: ['FIP'] };

const at = (hour: number, minute = 0) => new Date(2026, 9, 9, hour, minute);

const FUT = '/home/dev/app-a';
const PROJECT = 'group/app-a-frontend';
const GAME_CODES = 'libs/domain/hub/src/lib/opportunities/game-codes';

const editorBlock = (options: { branch: string; directories: string[] }): ActivityBlock => ({
  from: at(10, 45),
  to: at(11, 15),
  context: { repoPath: FUT, branch: options.branch },
  evidence: options.directories.map((directory, index) => ({
    kind: 'editor',
    at: at(10, 46 + index),
    detail: `read ${directory}`,
    directory,
  })),
});

const activity = (options: {
  iid: string;
  branch: string;
  title: string;
  minute: number;
}): MergeRequestActivityEvent => ({
  at: at(11, options.minute),
  source: 'gitlab',
  kind: 'merge-request-activity',
  eventId: `event-${options.iid}-${options.minute}`,
  action: 'commented on',
  projectPath: PROJECT,
  mergeRequestIid: options.iid,
  branch: options.branch,
  title: options.title,
});

const changes = (options: {
  iid: string;
  branch: string;
  directories: string[];
  minute: number;
}): MergeRequestChangesEvent => ({
  at: at(11, options.minute),
  source: 'git',
  kind: 'merge-request-changes',
  repoPath: FUT,
  eventId: `event-${options.iid}-${options.minute}`,
  projectPath: PROJECT,
  mergeRequestIid: options.iid,
  branch: options.branch,
  head: 'abc123',
  directories: options.directories,
});

const READ = [`${GAME_CODES}/game-code-bulk-edit/pages`, `${GAME_CODES}/game-code-view`];

const reviewDay = (events: CollectedEvent[], branch = 'main') =>
  buildRows({
    blocks: [editorBlock({ branch, directories: READ })],
    events: [
      { at: at(10, 50), source: 'window', kind: 'window-focus', appId: 'code', title: 'Visual Studio Code' },
      ...events,
    ],
    config,
  });

const onlyRow = (rows: ReturnType<typeof buildRows>) => [...rows.proposals, ...rows.unnamed][0];

describe('a band on a base branch beside a merge request of the same directories', () => {
  it('is named after the merge request', () => {
    const rows = reviewDay([
      activity({
        iid: '1095',
        branch: 'feature/disable-game-code-transfer-main',
        title: 'fix(hub): Restore game code order downloads on main',
        minute: 21,
      }),
      changes({
        iid: '1095',
        branch: 'feature/disable-game-code-transfer-main',
        directories: [`${GAME_CODES}/game-code-view`],
        minute: 21,
      }),
      activity({ iid: '1100', branch: 'feature/other', title: 'feat(platform): Something else', minute: 16 }),
      changes({
        iid: '1100',
        branch: 'feature/other',
        directories: ['libs/domain/platform/src/lib/campaign'],
        minute: 16,
      }),
    ]);

    expect(onlyRow(rows)?.description).toBe('fix(hub): Restore game code order downloads on main');
    expect(rows.unnamed).toHaveLength(1);
  });

  it('takes the issue the merge request names', () => {
    const rows = reviewDay([
      activity({
        iid: '1095',
        branch: 'feat/FIP-2177-restore-orders',
        title: 'fix(hub): Restore game code order downloads',
        minute: 21,
      }),
      changes({
        iid: '1095',
        branch: 'feat/FIP-2177-restore-orders',
        directories: [`${GAME_CODES}/game-code-view`],
        minute: 21,
      }),
    ]);

    expect(rows.proposals[0]?.issueKey).toBe('FIP-2177');
    expect(rows.proposals[0]?.description).toBe('fix(hub): Restore game code order downloads');
  });

  it('ignores a merge request of other directories, and describes the band by its own', () => {
    const rows = reviewDay([
      activity({ iid: '1100', branch: 'feature/other', title: 'feat(platform): Something else', minute: 16 }),
      changes({
        iid: '1100',
        branch: 'feature/other',
        directories: ['libs/domain/platform/src/lib/campaign'],
        minute: 16,
      }),
    ]);

    expect(onlyRow(rows)?.description).toBe('hub: game codes');
  });

  it('leaves a band on a branch with a subject to that branch', () => {
    const rows = reviewDay(
      [
        activity({ iid: '1095', branch: 'feature/x', title: 'fix(hub): Restore', minute: 21 }),
        changes({ iid: '1095', branch: 'feature/x', directories: [`${GAME_CODES}/game-code-view`], minute: 21 }),
      ],
      'feature/tidy-up-hub',
    );

    expect(onlyRow(rows)?.description).toBe('tidy up hub');
  });
});

describe('directoryLabel', () => {
  it('names the package most directories lie in and the deepest directory they share', () => {
    expect(directoryLabel([...READ, ...READ, 'libs/domain/platform/src/lib/campaign/configure-template-view'])).toBe(
      'hub: game codes',
    );
  });

  it('skips structural directories', () => {
    expect(directoryLabel([`${GAME_CODES}/game-code-bulk-edit/pages`])).toBe('hub: game code bulk edit');
    expect(directoryLabel(['apps/timetrack/src-tauri/src/transcribe'])).toBe('timetrack: transcribe');
  });

  it('decides a tie by path', () => {
    expect(directoryLabel(['libs/b/src/x', 'libs/a/src/y'])).toBe('a: y');
  });
});
