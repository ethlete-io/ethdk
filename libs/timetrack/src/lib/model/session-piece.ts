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

/** Where a file names one piece of work, and how many leading path segments name it. */
const NAMED_WORK_FILES = [
  { prefix: '.claude/handoffs/', segments: 3 },
  { prefix: 'plans/', segments: 2 },
  { prefix: '.changeset/', segments: 2 },
  { prefix: '.ethlete/design/calls/', segments: 5 },
];

/** The handoff, plan, changeset or design call a path names, or nothing. */
export const namedWorkFileOf = (path: string) => {
  const named = NAMED_WORK_FILES.find((candidate) => path.startsWith(candidate.prefix));
  const segments = path.replace(/\/+$/, '').split('/');

  if (!named || segments.length < named.segments) return undefined;

  return segments.slice(0, named.segments).join('/');
};

/** An app, its e2e app and its library share one name, and are one piece of work. */
const areaOf = (workPath: string | undefined) => workPath?.split('/').pop()?.replace(/-e2e$/, '');

type PieceUnit = { sessions: PieceSession[]; from: number; to: number; area?: string };

/**
 * The sessions that wrote a common named work file - a handoff, a plan or a design call - joined into
 * one unit each, oldest start first. Only such a file joins two sessions that ran at the same time:
 * two parallel sessions in one project are as often two pieces of work as one.
 */
const unitsOf = (
  sorted: readonly PieceSession[],
  areas: ReadonlyMap<PieceSession, readonly (string | undefined)[]>,
) => {
  const parent = new Map<PieceSession, PieceSession>(sorted.map((session) => [session, session]));
  const rootOf = (session: PieceSession): PieceSession => {
    const up = parent.get(session) ?? session;

    return up === session ? session : rootOf(up);
  };
  const byFile = new Map<string, PieceSession>();

  for (const session of sorted) {
    for (const path of session.paths) {
      const file = namedWorkFileOf(path);

      if (!file) continue;

      const first = byFile.get(file);

      if (!first) {
        byFile.set(file, session);
        continue;
      }

      const [older, newer] = [rootOf(first), rootOf(session)].sort(
        (left, right) => sorted.indexOf(left) - sorted.indexOf(right),
      );

      if (older && newer) parent.set(newer, older);
    }
  }

  const units = new Map<PieceSession, PieceSession[]>();

  for (const session of sorted) {
    const root = rootOf(session);

    units.set(root, [...(units.get(root) ?? []), session]);
  }

  return [...units.values()].map((sessions): PieceUnit => ({
    sessions,
    from: Math.min(...sessions.map((session) => session.from.getTime())),
    to: Math.max(...sessions.map((session) => session.to.getTime())),
    area: dominant(sessions.flatMap((session) => areas.get(session) ?? [])),
  }));
};

/**
 * The piece of work each agent session of one checkout belongs to, keyed by session id.
 *
 * Sessions that wrote a common handoff, plan or design call are one piece, whenever they ran. Beyond
 * that a session joins the piece of an earlier session that worked in the same project and had ended
 * before it started; an app, its e2e app and its library count as one project. Two sessions that ran
 * at the same time and share no such file stay two pieces. A session whose files name no directory
 * and no such file stays a piece of its own.
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
  const slices = new Map<PieceSession, (string | undefined)[]>();
  let offset = 0;

  for (const session of options.sessions) {
    slices.set(session, workPaths.slice(offset, offset + session.paths.length));
    offset += session.paths.length;
  }

  const areas = new Map([...slices].map(([session, paths]) => [session, paths.map(areaOf)]));
  const open = new Map<string, { piece: string; to: number }[]>();
  const found = new Map<string, SessionPiece>();

  for (const unit of unitsOf(sorted, areas)) {
    const candidates = unit.area ? (open.get(unit.area) ?? []) : [];
    const joined = candidates
      .filter((candidate) => candidate.to < unit.from)
      .sort((left, right) => right.to - left.to)[0];
    const piece = joined?.piece ?? unit.sessions[0]?.sessionId ?? '';

    if (joined) joined.to = Math.max(joined.to, unit.to);
    else if (unit.area) open.set(unit.area, [...candidates, { piece, to: unit.to }]);

    for (const session of unit.sessions)
      found.set(session.sessionId, { piece, workPath: dominant(slices.get(session) ?? []) });
  }

  return found;
};
