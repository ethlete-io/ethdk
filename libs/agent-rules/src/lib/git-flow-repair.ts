import { SyncConfig } from './config';
import { currentBranch, defaultRemote, git, gitLoud, localBranchExists, remoteBranchExists, remoteUrl } from './git';
import { conformingNameFor, parseBranch } from './git-flow';
import {
  blockingMergeRequests,
  GitLabMergeRequest,
  GitLabProject,
  gitLabToken,
  openMergeRequestsFor,
  parseRemoteUrl,
  retargetMergeRequest,
} from './gitlab';
import { confirm } from './prompt';

export type RepairRequest = {
  root: string;
  config: SyncConfig;
  ref?: string;
  to?: string;
  key?: string;
  skipMrCheck: boolean;
  assumeYes: boolean;
  dryRun: boolean;
};

const resolveNewName = (options: { branch: string; to?: string; key?: string; config: SyncConfig }) => {
  const { branch, to, key, config } = options;

  if (to) return to;

  const resolved = conformingNameFor({ branch, key, config: config.gitFlow });

  if (resolved.ok) return resolved.name;

  if (resolved.reason === 'already-conforms') throw new Error(`${branch} already conforms — nothing to repair.`);

  if (resolved.reason === 'needs-key') {
    throw new Error(
      `${branch} carries no issue key, so the new name needs one: \`git-flow repair ${branch} --key FIP-1234\` (or --to <branch>).`,
    );
  }

  throw new Error(`No conforming name can be derived from ${branch}. Pass --to <branch>.`);
};

type RemoteState =
  | { pushed: false }
  | {
      pushed: true;
      remote: string;
      retarget: GitLabMergeRequest[];
      /** Absent when `--no-mr-check` skipped the lookup, which is also why `retarget` may be empty. */
      api?: { project: GitLabProject; token: string };
    };

const readRemoteState = async (options: {
  root: string;
  branch: string;
  skipMrCheck: boolean;
}): Promise<RemoteState> => {
  const { root, branch, skipMrCheck } = options;
  const remote = defaultRemote(root);

  if (!remote || !remoteBranchExists({ root, remote, branch })) return { pushed: false };

  if (skipMrCheck) return { pushed: true, remote, retarget: [] };

  const project = parseRemoteUrl(remoteUrl({ root, remote }));
  const token = gitLabToken();

  if (!project || !token) {
    throw new Error(
      [
        `${branch} is pushed to ${remote}, so open merge requests may point at it and must be retargeted.`,
        project
          ? 'Set GITLAB_TOKEN to a token with the "api" scope, or pass --no-mr-check if you know none do.'
          : `The ${remote} URL is not a recognisable GitLab remote. Pass --no-mr-check if no merge request points at ${branch}.`,
      ].join('\n'),
    );
  }

  const mergeRequests = await openMergeRequestsFor({ project, token, branch });
  const blocking = blockingMergeRequests({ mergeRequests, branch });

  if (blocking.length > 0) {
    throw new Error(
      [
        `${branch} is the source branch of ${blocking.length} open merge request(s):`,
        ...blocking.map((mr) => `  !${mr.iid}  ${mr.title}  ${mr.url}`),
        'GitLab cannot move a merge request to a different source branch, and closing it would lose its discussion.',
        'Merge or close it first, then repair the branch.',
      ].join('\n'),
    );
  }

  return {
    pushed: true,
    remote,
    retarget: mergeRequests.filter((mr) => mr.targetBranch === branch),
    api: { project, token },
  };
};

const describeSteps = (options: { branch: string; newName: string; remote: RemoteState }) => {
  const { branch, newName, remote } = options;
  const steps = [`git branch -m ${branch} ${newName}`];

  if (remote.pushed) {
    steps.push(`git push -u ${remote.remote} ${newName}`);
    steps.push(...remote.retarget.map((mr) => `retarget !${mr.iid} to ${newName}`));
    steps.push(`git push ${remote.remote} --delete ${branch}`);
  }

  return steps;
};

/**
 * Renames a non-conforming branch and moves the merge requests aimed at it. Everything that can be
 * checked is checked before the first mutation, and the order of the mutations is chosen so a
 * failure leaves the old branch and every merge request intact.
 */
export const gitFlowRepair = async (request: RepairRequest) => {
  const { root, config, dryRun } = request;
  const branch = request.ref ?? currentBranch(root);
  const newName = resolveNewName({ branch, to: request.to, key: request.key, config });
  const parsed = parseBranch({ branch: newName, config: config.gitFlow });

  if (!parsed.ok) {
    console.error(`${newName} does not conform either:`);
    parsed.findings.forEach((finding) => console.error(`  ${finding.rule}   ${finding.message}`));

    return 1;
  }

  if (!localBranchExists({ root, branch })) {
    console.error(`${branch} does not exist locally — check it out first, then repair it.`);

    return 1;
  }

  if (localBranchExists({ root, branch: newName })) {
    console.error(`${newName} already exists locally.`);

    return 1;
  }

  const remote = await readRemoteState({ root, branch, skipMrCheck: request.skipMrCheck });

  if (remote.pushed && remoteBranchExists({ root, remote: remote.remote, branch: newName })) {
    console.error(`${newName} already exists on ${remote.remote}.`);

    return 1;
  }

  const steps = describeSteps({ branch, newName, remote });

  console.log('Repair');
  console.log(`  from      ${branch}`);
  console.log(`  to        ${newName}`);
  console.log(`  remote    ${remote.pushed ? `${remote.remote} (pushed)` : 'not pushed'}`);

  if (remote.pushed && !remote.api) console.log('  warn      merge requests were not checked (--no-mr-check)');

  if (remote.pushed) {
    remote.retarget.forEach((mr) => console.log(`  retarget  !${mr.iid}  ${mr.title}`));
  }

  console.log('\nSteps');
  steps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));

  if (dryRun) {
    console.log('\nDry run — nothing was changed.');

    return 0;
  }

  if (!(await confirm({ question: `\nRename ${branch} to ${newName}?`, assumeYes: request.assumeYes }))) {
    console.log('Nothing was changed.');

    return 1;
  }

  git({ root, args: ['branch', '-m', branch, newName] });

  if (!remote.pushed) {
    console.log(`\nRenamed to ${newName}.`);

    return 0;
  }

  gitLoud({ root, args: ['push', '-u', remote.remote, newName] });

  const { api } = remote;

  for (const mergeRequest of remote.retarget) {
    if (!api) break;

    try {
      await retargetMergeRequest({ project: api.project, token: api.token, iid: mergeRequest.iid, target: newName });
      console.log(`Retargeted !${mergeRequest.iid} to ${newName}.`);
    } catch (error) {
      console.error(`\nFailed to retarget !${mergeRequest.iid}: ${error instanceof Error ? error.message : error}`);
      console.error(
        [
          `${branch} still exists on ${remote.remote}, so nothing is broken — but the rename is half done.`,
          `Retarget the remaining merge request(s) to ${newName} by hand, then run:`,
          `  git push ${remote.remote} --delete ${branch}`,
          `Or undo: git branch -m ${newName} ${branch} && git push ${remote.remote} --delete ${newName}`,
        ].join('\n'),
      );

      return 1;
    }
  }

  gitLoud({ root, args: ['push', remote.remote, '--delete', branch] });

  console.log(`\nRenamed to ${newName} on ${remote.remote}.`);

  return 0;
};
