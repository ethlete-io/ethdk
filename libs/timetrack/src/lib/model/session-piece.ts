import { workPathsOf } from './work-path';

/** One agent session of a checkout: when it ran, and the files its tool calls named, relative to it. */
export type PieceSession = { sessionId: string; from: Date; to: Date; paths: readonly string[] };

const dominant = (paths: readonly (string | undefined)[]) => {
  const held = new Map<string, number>();
  let best: string | undefined;

  for (const path of paths) {
    if (!path) continue;

    const count = (held.get(path) ?? 0) + 1;

    held.set(path, count);

    if (!best || count > (held.get(best) ?? 0)) best = path;
  }

  return best;
};

/** The piece an agent session belongs to: its first session's id, and the directory it worked in. */
export type SessionPiece = { piece: string; workPath?: string };

/**
 * The piece of work each agent session of one checkout belongs to, keyed by session id.
 *
 * A session joins the piece of an earlier session that worked in the same directory and had ended
 * before it started. Two sessions that ran at the same time stay two pieces, whatever they touched.
 * A session whose files name no directory stays a piece of its own.
 *
 * A piece is named after its first session, so a session that joins later never renames it.
 */
export const sessionPieces = (options: {
  sessions: readonly PieceSession[];
  projectRoots?: readonly string[];
}): Map<string, SessionPiece> => {
  const commits = options.sessions.flatMap((session) => session.paths.map((path) => ({ paths: [path] })));
  const workPaths = workPathsOf({ commits, projectRoots: options.projectRoots });
  const sorted = [...options.sessions].sort((left, right) => left.from.getTime() - right.from.getTime());
  const offsets = new Map<PieceSession, number>();
  let offset = 0;

  for (const session of options.sessions) {
    offsets.set(session, offset);
    offset += session.paths.length;
  }

  const open = new Map<string, { piece: string; to: number }[]>();
  const found = new Map<string, SessionPiece>();

  for (const session of sorted) {
    const start = offsets.get(session) ?? 0;
    const workPath = dominant(workPaths.slice(start, start + session.paths.length));
    const candidates = workPath ? (open.get(workPath) ?? []) : [];
    const joined = candidates
      .filter((candidate) => candidate.to < session.from.getTime())
      .sort((left, right) => right.to - left.to)[0];

    if (joined) {
      joined.to = Math.max(joined.to, session.to.getTime());
      found.set(session.sessionId, { piece: joined.piece, workPath });
      continue;
    }

    found.set(session.sessionId, { piece: session.sessionId, workPath });

    if (workPath) open.set(workPath, [...candidates, { piece: session.sessionId, to: session.to.getTime() }]);
  }

  return found;
};
