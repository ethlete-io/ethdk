import { TimetrackProjectLink, matchProjectLink } from '../correlate/project-link';
import { TimetrackFavoriteProject } from './model';

/** A word short enough to appear in any directory name says nothing about which project it is. */
const MIN_NAME_WORD_LENGTH = 4;

const segmentsOf = (path: string) => path.trim().replace(/\/+$/, '').split('/').filter(Boolean);

const tokensOf = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const nameWordsOf = (name: string) => tokensOf(name).filter((word) => word.length >= MIN_NAME_WORD_LENGTH);

/**
 * Whether a repository's own directory name names this project — its key as a whole token, or every
 * long word of its name. Token-wise on purpose: `abc-frontend` names `ABC`, and `abcdefg` does not.
 */
const namesProject = (options: { tokens: readonly string[]; project: TimetrackFavoriteProject }) => {
  const { tokens, project } = options;

  if (tokens.includes(project.key.toLowerCase())) return true;

  const words = nameWordsOf(project.name);

  return words.length > 0 && words.every((word) => tokens.includes(word));
};

/**
 * The project a repository's path suggests, or nothing when the path names none or names two.
 *
 * It reads only the directory name, which makes it a suggestion and never a decision: nothing here is
 * evidence of what the work belongs to, and a link is written when the user confirms one. Two matching
 * projects yield nothing — filing into the wrong project is worse than an empty field, because a ticket
 * cannot be moved by the person who has to explain it.
 */
export const suggestProjectForRepo = (options: {
  repoPath: string;
  projects: readonly TimetrackFavoriteProject[];
}): TimetrackFavoriteProject | undefined => {
  const segment = segmentsOf(options.repoPath).pop();

  if (!segment) return undefined;

  const tokens = tokensOf(segment);
  const found = options.projects.filter((project) => namesProject({ tokens, project }));

  return found.length === 1 ? found[0] : undefined;
};

/** One watched repository as the settings screen lists it: what it is linked to, and what it could be. */
export type RepoProjectRow = {
  repoPath: string;
  /** The last segment of the path, which is what the user recognises the repository by. */
  label: string;
  /** The link that already covers this path, whether it names this repository or a root above it. */
  link?: TimetrackProjectLink;
  /** The project the link names, or nothing when the link marks the path private. */
  projectKey?: string;
  /** Whether the link covering it names a directory above it rather than this repository itself. */
  inherited: boolean;
  private: boolean;
  /** What the path suggests, offered only while nothing covers it yet. */
  suggestion?: TimetrackFavoriteProject;
};

/**
 * Every watched repository beside what it is logged into, so the mapping is one list rather than a set
 * of paths typed by hand.
 *
 * A repository covered by a root above it is reported as inherited rather than as unlinked: the answer
 * for `~/dev` is already there, and offering to write it again per repository would fill the document
 * with links that say what one link already said.
 */
export const repoProjectRows = (options: {
  repoPaths: readonly string[];
  links: readonly TimetrackProjectLink[];
  projects: readonly TimetrackFavoriteProject[];
}): RepoProjectRow[] =>
  [...options.repoPaths]
    .sort((a, b) => a.localeCompare(b))
    .map((repoPath) => {
      const link = matchProjectLink({ context: { repoPath }, links: options.links });
      const target = link?.target;
      const inherited = !!link && link.path.trim().replace(/\/+$/, '') !== repoPath.trim().replace(/\/+$/, '');

      return {
        repoPath,
        label: segmentsOf(repoPath).pop() ?? repoPath,
        link,
        projectKey: target?.kind === 'project' ? target.projectKey : undefined,
        inherited,
        private: target?.kind === 'private',
        suggestion: link ? undefined : suggestProjectForRepo({ repoPath, projects: options.projects }),
      };
    });
