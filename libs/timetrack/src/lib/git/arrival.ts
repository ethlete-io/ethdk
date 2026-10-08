import { GIT_FIELD_SEPARATOR, GitScanWindow } from './format';

const SELECTOR = /^(.+)@\{(.+)\}$/;
const OBJECT_NAME = /^[0-9a-f]{40,64}$/;

const MADE_HERE = /^commit\b|^(cherry-pick|revert|am)\b|\((pick|reword|edit|squash|fixup|continue)\)/;

type ReflogEntry = { ref: string; at: Date; action: string; sha: string };

export type GitArrival = { at: Date; to: string; from?: string };

export type GitArrivals = { madeHere: ReadonlySet<string>; arrivals: GitArrival[] };

const entriesOf = (output: string): ReflogEntry[] =>
  output.split('\n').flatMap((line): ReflogEntry[] => {
    const [selector, action, sha] = line.split(GIT_FIELD_SEPARATOR);
    const parts = selector ? SELECTOR.exec(selector.trim()) : null;
    const ref = parts?.[1];
    const at = parts?.[2] ? new Date(parts[2]) : undefined;
    const object = sha?.trim();

    if (!ref || !at || Number.isNaN(at.getTime()) || action === undefined || !object || !OBJECT_NAME.test(object))
      return [];

    return [{ ref, at, action: action.trim(), sha: object }];
  });

/**
 * Reads the reflogs of every checkout of one repository, each from `git reflog show HEAD --branches`
 * with `GIT_REFLOG_FORMAT`. A commit a reflog entry wrote was made here; every other move of a local
 * branch inside `window` is an arrival, whose new commits `gitArrivalArgs` lists.
 */
export const gitArrivalsOf = (options: { outputs: readonly string[]; window: GitScanWindow }): GitArrivals => {
  const entries = options.outputs.flatMap(entriesOf);
  const madeHere = new Set(entries.filter((entry) => MADE_HERE.test(entry.action)).map((entry) => entry.sha));
  const byRef = new Map<string, ReflogEntry[]>();

  for (const entry of entries) {
    if (entry.ref === 'HEAD') continue;

    byRef.set(entry.ref, [...(byRef.get(entry.ref) ?? []), entry]);
  }

  const arrivals = [...byRef.values()].flatMap((moves) => {
    const ordered = [...moves].sort((a, b) => a.at.getTime() - b.at.getTime());

    return ordered.flatMap((entry, index): GitArrival[] => {
      const from = ordered[index - 1]?.sha;

      if (MADE_HERE.test(entry.action) || entry.sha === from) return [];
      if (entry.at < options.window.from || entry.at > options.window.to) return [];

      return [{ at: entry.at, to: entry.sha, ...(from ? { from } : {}) }];
    });
  });

  return { madeHere, arrivals };
};

export const gitArrivalArgs = (options: { arrival: GitArrival; window: GitScanWindow }) => [
  'log',
  '--no-merges',
  '--format=%H',
  `--since=${options.window.from.toISOString()}`,
  options.arrival.to,
  ...(options.arrival.from ? [`^${options.arrival.from}`] : []),
];

/**
 * When each commit this machine did not write first arrived here, from the `gitArrivalArgs` output of
 * every arrival. A commit a reflog says was made here is never in it, whatever later move carried it again.
 */
export const gitArrivedAt = (options: {
  arrivals: GitArrivals;
  listed: readonly { arrival: GitArrival; output: string }[];
}): Map<string, Date> => {
  const arrived = new Map<string, Date>();

  for (const { arrival, output } of options.listed) {
    for (const line of output.split('\n')) {
      const sha = line.trim();

      if (!sha || options.arrivals.madeHere.has(sha)) continue;

      const known = arrived.get(sha);

      if (!known || arrival.at < known) arrived.set(sha, arrival.at);
    }
  }

  return arrived;
};
