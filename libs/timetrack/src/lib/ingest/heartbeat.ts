import { IngestRecord } from './model';

/**
 * How often a reporter posts while its window has focus. It matches the app's own drain interval, and
 * it is what bounds the error at both ends of a stretch: the block starts at the first heartbeat and
 * ends at the last, so half a minute is the most that can be missed either way.
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

/** What an editor knows about itself when it is time to report. */
export type EditorSnapshot = {
  at: Date;
  /** The checkout the editor has open, when the file is inside one. */
  repoPath?: string;
  branch?: string;
  /** The absolute path of the file in the active editor, when there is one. */
  filePath?: string;
  /** The editor's own name for the language, such as `typescript`. */
  language?: string;
  /** Whether the file changed since the previous heartbeat, as opposed to being read. */
  editing: boolean;
};

const SEPARATOR = /[/\\]/;

/** The directory part of a path, with no trailing separator and `undefined` for a bare file name. */
const directoryOf = (path: string) => {
  const parts = path.split(SEPARATOR);

  parts.pop();

  return parts.join('/') || undefined;
};

/**
 * The path of `filePath` relative to `repoPath`, or the whole path when it is not inside it.
 *
 * Comparison is exact rather than case-insensitive: a checkout and the file in it come from the same
 * editor and the same API, so they already agree on spelling, and folding case here would make a
 * directory that genuinely differs by case look like the same one.
 */
const relativeTo = (options: { path: string; root?: string }) => {
  const { path, root } = options;

  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
};

/**
 * The record a snapshot posts, or `null` for a snapshot that says nothing worth keeping.
 *
 * A window with no file and no checkout is one of those: the reporter only speaks while its window
 * has focus, so an empty editor would otherwise report a stretch of nothing as work in progress.
 */
export const heartbeatRecordOf = (snapshot: EditorSnapshot): IngestRecord | null => {
  const relative = snapshot.filePath ? relativeTo({ path: snapshot.filePath, root: snapshot.repoPath }) : undefined;
  const directory = relative ? directoryOf(relative) : undefined;

  if (!snapshot.repoPath && !directory) return null;

  return {
    atMs: snapshot.at.getTime(),
    kind: 'editor-heartbeat',
    ...(snapshot.repoPath ? { repoPath: snapshot.repoPath } : {}),
    ...(snapshot.branch ? { branch: snapshot.branch } : {}),
    ...(directory ? { directory } : {}),
    ...(snapshot.language ? { language: snapshot.language } : {}),
    editing: snapshot.editing,
  };
};

/**
 * The branch `.git/HEAD` names, or `undefined` for a detached head or an unreadable file.
 *
 * Reading the file rather than running `git` is what lets a reporter inside an editor report a branch
 * without spawning a process on every heartbeat. A detached head has no branch to report, and
 * reporting the sha instead would put a name in the store that the grammar can never resolve.
 */
export const gitHeadBranch = (contents: string) => {
  const ref = contents.trim();

  return ref.startsWith('ref: refs/heads/') ? ref.slice('ref: refs/heads/'.length) || undefined : undefined;
};
