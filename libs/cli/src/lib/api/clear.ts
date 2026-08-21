import { rmSync } from 'fs';
import { confirm } from '../utils';
import { ApiDefinitions } from './definition';
import { uncommittedChanges, unpushedCommits } from './git';
import { managedCheckoutPath, resolveApiCheckout } from './resolve-checkout';

export type ApiClearTarget = {
  name: string;
  /** Absolute path that would be removed. */
  repoPath: string;
  /** Directory that holds the compose file. */
  composePath: string;
  /** Whether any container of its compose project still exists. Those are taken down before the removal. */
  hasContainers: boolean;
  /** Why it must stay. Empty when it can be removed. */
  blockers: string[];
};

const MAX_LISTED = 5;

/** The first few lines of a git listing, so a refusal shows what stands in the way. */
const listed = (lines: string[]) =>
  [
    ...lines.slice(0, MAX_LISTED).map((line) => `  ${line}`),
    ...(lines.length > MAX_LISTED ? [`  and ${lines.length - MAX_LISTED} more`] : []),
  ].join('\n');

export type ApiClearPlanOptions = {
  apis: ApiDefinitions;
  names: string[];
  root: string;
  invocation: string;
  /** Skips the checks on uncommitted changes and unpushed commits. */
  force: boolean;
  /** Whether any container of the API's compose project exists. */
  hasContainers: (composePath: string) => boolean;
};

/**
 * What `clear` would do to each named API: the path it would remove, and every reason it must stay.
 * An API without a managed checkout is left out, because there is nothing of ours to remove.
 */
export const planApiClear = (options: ApiClearPlanOptions): ApiClearTarget[] => {
  const { apis, names, root, invocation, force, hasContainers } = options;

  return names.flatMap((name) => {
    const api = apis[name];

    if (!api) return [];

    const checkout = resolveApiCheckout({ root, name, api, needs: 'repo' });

    if (!checkout.ok) return [];

    const { repoPath, composePath } = checkout.checkout;
    const managed = managedCheckoutPath(root, name);

    if (repoPath !== managed) {
      return [
        {
          name,
          repoPath,
          composePath,
          hasContainers: false,
          blockers: [
            `${repoPath} is your own checkout, not the one ${invocation} manages. ` +
              `Remove it yourself, or drop apiRepoPaths.${name} first.`,
          ],
        },
      ];
    }

    const changes = uncommittedChanges(repoPath);
    const unpushed = unpushedCommits(repoPath);

    return [
      {
        name,
        repoPath,
        composePath,
        hasContainers: hasContainers(composePath),
        blockers: [
          ...(!force && changes.length > 0
            ? [
                `${repoPath} has uncommitted changes:\n\n${listed(changes)}\n\n` +
                  'Commit them, or pass --force to lose them.',
              ]
            : []),
          ...(!force && unpushed.length > 0
            ? [
                `${repoPath} has commits no remote holds:\n\n${listed(unpushed)}\n\n` +
                  'Push them, or pass --force to lose them.',
              ]
            : []),
        ],
      },
    ];
  });
};

export type ApiClearOptions = ApiClearPlanOptions & {
  /** Takes the containers of one compose project down. False when the compose command failed. */
  takeDown: (composePath: string) => boolean;
};

/**
 * Removes the managed checkout of each named API, after one question that defaults to no. It offers to
 * take down the containers that still exist, and refuses an API with work only this checkout holds.
 */
export const clearApiCheckouts = async (options: ApiClearOptions): Promise<number> => {
  const { names, invocation, takeDown } = options;
  const targets = planApiClear(options);
  const blocked = targets.filter(({ blockers }) => blockers.length > 0);
  const removable = targets.filter(({ blockers }) => blockers.length === 0);

  for (const { blockers } of blocked) {
    console.error(blockers.join('\n\n'));
  }

  if (blocked.length > 0) console.error('');

  if (removable.length === 0) {
    if (blocked.length === 0) {
      console.log(`Nothing to remove. ${names.join(', ')} has no checkout ${invocation} manages.`);
    }

    return blocked.length > 0 ? 1 : 0;
  }

  const paths = removable.map(({ repoPath }) => `  ${repoPath}`).join('\n');
  const running = removable.filter(({ hasContainers }) => hasContainers).map(({ name }) => name);
  const stopped = running.join(', ');
  const checkouts = removable.length === 1 ? 'the checkout' : 'the checkouts';
  const accepted = await confirm({
    problem: running.length > 0 ? `This takes ${stopped} down, then removes:\n\n${paths}` : `This removes:\n\n${paths}`,
    question:
      running.length > 0
        ? `Take ${stopped} down and remove ${checkouts}?`
        : `Remove ${removable.map(({ name }) => name).join(', ')}?`,
    hint:
      running.length > 0
        ? `Re-run in a terminal to answer the question, or run "${invocation} down ${stopped}" and remove the ` +
          'directories yourself.'
        : 'Re-run in a terminal to answer the question, or remove the directories yourself.',
    defaultsToYes: false,
  });

  if (!accepted) return 1;

  let failed = 0;

  for (const { name, repoPath, composePath, hasContainers } of removable) {
    if (hasContainers && !takeDown(composePath)) {
      console.error(`Could not take ${name} down, so ${repoPath} stays.`);
      failed += 1;

      continue;
    }

    rmSync(repoPath, { recursive: true, force: true });
    console.log(`Removed ${repoPath}. Run "${invocation} clone ${name}" to get it back.`);
  }

  return blocked.length > 0 || failed > 0 ? 1 : 0;
};
