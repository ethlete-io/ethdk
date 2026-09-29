import { AgentUsageEvent, GitCommitEvent } from '../model/event';
import { Evidence } from '../model/evidence';
import { namedWorkFileOf } from '../model/session-piece';

/** One observation of what an agent session produced, to be filed under that session's own stretch. */
export type SessionWork = { repoPath: string; sessionId: string; gitBranch?: string; evidence: Evidence };

const WORK_FILE_LABELS: readonly { prefix: string; label: string }[] = [
  { prefix: '.claude/handoffs/', label: 'handoff' },
  { prefix: 'plans/', label: 'plan' },
  { prefix: '.changeset/', label: 'changeset' },
  { prefix: '.ethlete/design/calls/', label: 'design call' },
];

const workFileSummary = (file: string) => {
  const kind = WORK_FILE_LABELS.find((entry) => file.startsWith(entry.prefix));
  const name =
    file
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') ?? file;

  return kind ? `${kind.label} ${name.replace(/[-_]+/g, ' ')}` : name;
};

/**
 * What each agent session produced: the handoff, plan, changeset or design call its turns wrote, and
 * the commits that changed a file its turns named before the commit. A commit names no session, so
 * without this a session running beside another in one checkout is left with its title alone - often
 * the prompt that opened it.
 */
export const sessionWork = (options: {
  turns: readonly AgentUsageEvent[];
  commits: readonly GitCommitEvent[];
  checkoutOf: (cwd: string) => string | undefined;
}): SessionWork[] => {
  const found: SessionWork[] = [];
  const touched = new Map<
    string,
    { repoPath: string; sessionId: string; gitBranch?: string; files: Map<string, number> }
  >();

  for (const turn of options.turns) {
    const repoPath = turn.workedIn ? options.checkoutOf(turn.cwd) : undefined;

    if (!repoPath || !turn.workedIn?.startsWith(`${repoPath}/`) || turn.workedIn.endsWith('/')) continue;

    const path = turn.workedIn.slice(repoPath.length + 1);
    const key = `${repoPath}\u0000${turn.sessionId}`;
    const session = touched.get(key) ?? {
      repoPath,
      sessionId: turn.sessionId,
      gitBranch: turn.gitBranch,
      files: new Map(),
    };
    const firstAt = session.files.get(path);

    touched.set(key, session);

    if (firstAt !== undefined && firstAt <= turn.at.getTime()) continue;

    session.files.set(path, turn.at.getTime());

    const file = firstAt === undefined ? namedWorkFileOf(path) : undefined;

    if (file) {
      found.push({
        repoPath,
        sessionId: turn.sessionId,
        gitBranch: turn.gitBranch,
        evidence: { kind: 'work-file', at: turn.at, detail: `wrote ${file}`, summary: workFileSummary(file) },
      });
    }
  }

  for (const commit of options.commits) {
    for (const session of touched.values()) {
      if (session.repoPath !== commit.repoPath) continue;

      const wrote = (commit.paths ?? []).some((path) => (session.files.get(path) ?? Infinity) <= commit.at.getTime());

      if (!wrote) continue;

      found.push({
        repoPath: session.repoPath,
        sessionId: session.sessionId,
        gitBranch: commit.branch,
        evidence: {
          kind: 'commit',
          at: commit.at,
          detail: `${commit.sha.slice(0, 7)} ${commit.subject}`,
          summary: commit.subject,
        },
      });
    }
  }

  return found;
};
