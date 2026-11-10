import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { repoRootOf } from './reachable-files';
import { RenderIssue } from './render-check';
import { sameRenderIssueKeyOf } from './render-issue-key';
import { ResolvedProduct } from './resolve-product';

/** The render issues a part showed at a commit, drawn while its inputs had no change from that commit. */
export type BaseIssuesEntry = { commit: string; issues: RenderIssue[] };

/** The base issues of each part of a product, by part key. */
export type BaseIssues = Record<string, BaseIssuesEntry>;

/** A drawn part: its key, and the repo-relative files and folders (ending in `/`) its drawing reads. */
export type DrawnPartInputs = { part: string; inputs: string[] };

/** The gitignored file that holds a product's base issues, next to its slow results. */
export const baseIssuesFileOf = (product: ResolvedProduct) =>
  join(repoRootOf(product), 'node_modules', '.cache', 'ethlete-design', product.name, 'base-issues.json');

const gitLinesOf = (root: string, args: string[]) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' })
      .split('\n')
      .filter((line) => line !== '');
  } catch {
    return null;
  }
};

const readBaseIssues = (file: string): BaseIssues => {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as BaseIssues) : {};
  } catch {
    return {};
  }
};

const touches = (changed: string[], inputs: string[]) =>
  changed.some((path) => inputs.some((input) => (input.endsWith('/') ? path.startsWith(input) : path === input)));

/**
 * Splits the render issues of a run into new and old (ADR 0095): an issue is old when HEAD already shows it. A drawn
 * part whose inputs the working tree does not change shows HEAD itself, so all its issues are old, and they are stored
 * in `file` as the part's base. A part the working tree changes compares against its stored base, which holds only
 * while no commit since changed its inputs; without one, every issue counts as new.
 */
export const oldRenderIssuesOf = (options: {
  root: string;
  file: string;
  parts: DrawnPartInputs[];
  issues: RenderIssue[];
}): Set<RenderIssue> => {
  const { root, file, parts, issues } = options;
  const head = gitLinesOf(root, ['rev-parse', 'HEAD'])?.[0];
  const dirty = [
    ...(gitLinesOf(root, ['diff', '--name-only', '--no-renames', 'HEAD']) ?? []),
    ...(gitLinesOf(root, ['ls-files', '--others', '--exclude-standard']) ?? []),
  ];

  if (!head) return new Set();

  const stored = readBaseIssues(file);
  const changedSince = new Map<string, string[] | null>();
  const changedSinceOf = (commit: string) => {
    if (!changedSince.has(commit))
      changedSince.set(commit, gitLinesOf(root, ['diff', '--name-only', '--no-renames', commit, 'HEAD']));

    return changedSince.get(commit) ?? null;
  };
  const old = new Set<RenderIssue>();
  let written = false;

  for (const { part, inputs } of parts) {
    const own = issues.filter((issue) => issue.part === part);

    if (!touches(dirty, inputs)) {
      own.forEach((issue) => old.add(issue));
      stored[part] = { commit: head, issues: own };
      written = true;
      continue;
    }

    const base = stored[part];
    const since = base ? changedSinceOf(base.commit) : null;

    if (!base || !since || touches(since, inputs)) continue;

    const keys = new Set(base.issues.map((issue) => sameRenderIssueKeyOf(issue, null)));

    own.filter((issue) => keys.has(sameRenderIssueKeyOf(issue, null))).forEach((issue) => old.add(issue));
  }

  if (written) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`);
  }

  return old;
};
