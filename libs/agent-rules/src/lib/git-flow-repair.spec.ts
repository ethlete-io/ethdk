import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncConfig } from './config';
import { DEFAULT_GIT_FLOW_CONFIG } from './git-flow';
import { gitFlowRepair } from './git-flow-repair';

const OLD = 'dev-thing';
const NEW = 'feat/FIP-1-thing';

vi.mock('./git', () => ({
  currentBranch: () => OLD,
  defaultRemote: () => 'origin',
  localBranchExists: (options: { branch: string }) => options.branch === OLD,
  remoteBranchExists: (options: { branch: string }) => options.branch === OLD,
  remoteUrl: () => '',
  git: vi.fn(() => ''),
  gitLoud: vi.fn(() => {
    throw new Error('remote rejected');
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('gitFlowRepair', () => {
  it('prints a retry and an undo hint when the push after the rename fails', async () => {
    const errors: string[] = [];

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => errors.push(args.join(' ')));

    const result = await gitFlowRepair({
      root: '/repo',
      config: { gitFlow: DEFAULT_GIT_FLOW_CONFIG } as SyncConfig,
      to: NEW,
      skipMrCheck: true,
      assumeYes: true,
      dryRun: false,
    });

    expect(result).toBe(1);
    expect(errors.join('\n')).toContain(`Or undo: git branch -m ${NEW} ${OLD}`);
  });
});
