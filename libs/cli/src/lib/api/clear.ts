import { rmSync } from 'fs';
import { confirm } from '../utils';
import { ApiDefinitions } from './definition';
import { uncommittedChanges, unpushedCommits } from './git';
import { managedCheckoutPath, resolveApiCheckout } from './resolve-checkout';

export type ApiClearTarget = {
  name: string;
  /** Absolute path that would be removed. */
  repoPath: string;
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
  /** Skips the checks on uncommitted changes and unpushed commits. Never skips the running check. */
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
        blockers: [
          ...(hasContainers(composePath)
            ? [`${name} still has containers. Run "${invocation} down ${name}" first.`]
            : []),
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

/**
 * Removes the managed checkout of each named API, after one question that defaults to no. It refuses
 * an API whose containers still exist, and an API with work only this checkout holds.
 */
export const clearApiCheckouts = async (options: ApiClearPlanOptions): Promise<number> => {
  const { names, invocation } = options;
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

  const paths = removable.map(({ repoPath }) => repoPath);
  const accepted = await confirm({
    problem: `This removes:\n\n${paths.map((path) => `  ${path}`).join('\n')}`,
    question: `Remove ${removable.map(({ name }) => name).join(', ')}?`,
    hint: 'Re-run in a terminal to answer the question, or remove the directories yourself.',
    defaultsToYes: false,
  });

  if (!accepted) return 1;

  for (const { name, repoPath } of removable) {
    rmSync(repoPath, { recursive: true, force: true });
    console.log(`Removed ${repoPath}. Run "${invocation} clone ${name}" to get it back.`);
  }

  return blocked.length > 0 ? 1 : 0;
};
