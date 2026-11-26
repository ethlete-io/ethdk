import { GIT_FIELD_SEPARATOR } from './format';

const SELECTOR = /^HEAD@\{(.+)\}$/;
const CHECKOUT = /^checkout: moving from (.+) to (.+)$/;

/**
 * A detached checkout records the object name where a branch would be. Nothing resolves refs here, so a
 * bare hex name is read as a commit rather than a branch — the cost is a branch someone named in hex.
 */
const OBJECT_NAME = /^[0-9a-f]{7,40}$/;

export type GitBranchSwitch = { at: Date; from: string; to: string };

export const branchOrNothing = (name: string) => (OBJECT_NAME.test(name) ? undefined : name);

/**
 * The `checkout: moving from … to …` entries of `git reflog show` output, oldest first. A rebase's or a
 * pull's internal checkouts are tooling moving HEAD around, not the user changing what they work on.
 */
export const gitBranchSwitchesIn = (output: string): GitBranchSwitch[] => {
  const found: GitBranchSwitch[] = [];

  for (const line of output.split('\n')) {
    const [selector, subject] = line.split(GIT_FIELD_SEPARATOR);
    const stamp = selector ? SELECTOR.exec(selector.trim())?.[1] : undefined;
    const moved = subject ? CHECKOUT.exec(subject.trim()) : null;
    const from = moved?.[1];
    const to = moved?.[2];

    if (!stamp || !from || !to) continue;

    const at = new Date(stamp);

    if (Number.isNaN(at.getTime())) continue;

    found.push({ at, from, to });
  }

  return found.sort((a, b) => a.at.getTime() - b.at.getTime());
};
