/** A field separator a branch name, a ref, a subject or a path cannot contain. */
export const GIT_FIELD_SEPARATOR = '\u001f';

/**
 * `%gd` renders the reflog's own timestamp under `--date=iso-strict`, which is the instant the branch
 * was actually switched. A commit or author date would be a different moment entirely.
 */
export const GIT_REFLOG_FORMAT = `%gd${GIT_FIELD_SEPARATOR}%gs`;

/**
 * `%S` names the ref the commit was reached from, which is the only way a plain `git log` says which
 * branch a commit belongs to. It is filled in from the refs given on the command line, so the query has
 * to keep passing `--branches`.
 */
export const GIT_LOG_FORMAT = `%H${GIT_FIELD_SEPARATOR}%aI${GIT_FIELD_SEPARATOR}%S${GIT_FIELD_SEPARATOR}%s`;

/**
 * Whether the line is the header of a commit rather than one of the paths that follow it.
 *
 * `--name-only` prints the format line, a blank line, then one path per line, and the only thing that
 * tells the two apart is the separator — which a path cannot contain.
 */
export const isGitLogHeader = (line: string) => line.includes(GIT_FIELD_SEPARATOR);

/** The instants a scan reads. Both parsers filter to it, so rescanning a day re-emits nothing. */
export type GitScanWindow = { from: Date; to: Date };
