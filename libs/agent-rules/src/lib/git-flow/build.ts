import { GitFlowConfig } from './config';

export const slugifySubject = (subject: string) =>
  subject
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * `parent` is the full branch name the new branch nests under — `feat/FIP-2177-user-management`
 * for a sub-feature, `release/2026.04.28` for a release fix.
 */
export type BranchNameSpec =
  | { kind: 'main-feature'; type?: string; key: string; subject: string }
  | { kind: 'sub-feature'; parent: string; key: string; subject: string }
  | { kind: 'release'; date: string }
  | { kind: 'release-fix'; parent: string; key: string; subject: string }
  | { kind: 'hotfix'; key: string; subject: string };

/** Builds a conforming branch name from the grammar. The single naming implementation. */
export const buildBranchName = (options: { spec: BranchNameSpec; config: GitFlowConfig }) => {
  const { spec, config } = options;

  if (spec.kind === 'release') return `${config.releasePrefix}/${spec.date}`;

  const leaf = [spec.key.toUpperCase(), slugifySubject(spec.subject)].filter(Boolean).join('-');

  if (spec.kind === 'main-feature') return `${spec.type ?? 'feat'}/${leaf}`;
  if (spec.kind === 'hotfix') return `${config.hotfixPrefix}/${leaf}`;

  return `${spec.parent}/${leaf}`;
};
