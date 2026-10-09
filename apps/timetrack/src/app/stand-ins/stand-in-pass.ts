import {
  CollectedEvent,
  Stream,
  TimetrackProjectLink,
  UnnamedContext,
  WorkGroup,
  autoStandIns,
  checkoutOf,
  findStandIn,
  gitFlowConfigFor,
  standInBranches,
} from '@ethlete/timetrack';
import { injectTimetrackSettings } from '../settings/settings';

/**
 * Opens a placeholder for each linked checkout a day could not name, and records the day on every
 * placeholder the day's rows already carry. The day screen runs it for the day on screen, and auto mode
 * for today while the screen shows another day.
 */
export const runStandInPass = (options: {
  settings: NonNullable<ReturnType<typeof injectTimetrackSettings>>;
  day: string;
  contexts: readonly UnnamedContext[];
  unattributed: readonly WorkGroup[];
  events: readonly CollectedEvent[];
  links: readonly TimetrackProjectLink[];
  repoRoots: readonly string[] | null | undefined;
  offeredCheckouts: readonly string[];
  standInIds: readonly string[];
  streams: readonly Pick<Stream, 'repoPath' | 'branches'>[];
}) => {
  const { settings, day } = options;
  const current = settings.settings();
  const config = gitFlowConfigFor(current);
  const opened = autoStandIns({
    contexts: options.contexts,
    unattributed: options.unattributed,
    events: options.events,
    links: options.links,
    rules: current.attributionRules,
    config,
    repoRoots: options.repoRoots,
    offeredCheckouts: options.offeredCheckouts,
    standIns: current.standIns,
    refused: current.noStandInCheckouts,
    day,
    now: new Date(),
  });

  for (const entry of opened) settings.nameWithStandIn({ standIn: entry.standIn, rule: entry.rule });

  const baseBranches = [config.baseBranches.development, config.baseBranches.production];

  for (const id of new Set(options.standInIds)) {
    const standIn = findStandIn({ id, standIns: settings.settings().standIns });

    if (!standIn) continue;

    const checkout = checkoutOf({ settings: current, standIn });
    /** A placeholder with a branch of its own holds that branch and no other, whatever else ran. */
    const branches = standIn.openedForBranch
      ? [standIn.openedForBranch]
      : options.streams
          .filter((stream) => !!checkout && stream.repoPath === checkout)
          .flatMap((stream) => stream.branches);
    const heldOn = standInBranches({ standIn, branches, baseBranches });

    /** A day already listed is written again once the checkout swapped branch: the grain grew. */
    if (!standIn.days.includes(day) || heldOn.length !== (standIn.heldOn?.length ?? 0))
      settings.markStandInDay({ id, day, branches, baseBranches });
  }

  return opened.length;
};
