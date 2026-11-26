const SEPARATOR = '\t';
const PANE_FORMAT = [
  'session_id',
  'session_name',
  'session_created',
  'session_path',
  'pane_id',
  'pane_dead',
  'pane_dead_time',
  'pane_current_command',
  'ETHLETE_CODEX_OWNER',
]
  .map((field) => `#{${field}}`)
  .join(SEPARATOR);

const KEEP_ENDED_MS = 60 * 60_000;
const TAIL_LINES = 12;
const CODEX_NAME = /^codex(?:-|@|$)/;
const INPUT_HINT = /\b(?:to submit (?:answer|all)|to confirm|to approve|to select)\b/i;
const WORKING_HINT = /\([^)]*\b(?:esc|ctrl\+c) to interrupt\)/i;
const PROMPT = /^\s*›(?:\s|$)/;

type TmuxResult = { stdout: string; stderr: string; exitCode: number | null };
type Tmux = (args: string[]) => Promise<TmuxResult>;
type Scope = { sessionId: string; root: string };
type Pane = {
  id: string;
  name: string;
  paneId: string;
  cwd: string;
  owner: string;
  startedAt: number;
  dead: boolean;
  endedAt: number | null;
};

export type CodexRun = Omit<Pane, 'dead' | 'paneId'> & {
  state: 'running' | 'waiting for input' | 'ended';
  tail: string[];
};

const visibleTo = ({ owner, cwd }: { owner: string; cwd: string }, { sessionId, root }: Scope) =>
  owner !== '' ? owner === sessionId : cwd === root || cwd.startsWith(`${root.replace(/\/$/, '')}/`);

function codexPanes(stdout: string): Pane[] {
  const panes = new Map<string, { pane: Pane; rank: number }>();
  for (const line of stdout.split('\n')) {
    const [session, name, created, cwd, paneId, dead, ended, command, owner = ''] = line.split(SEPARATOR);
    const startedAt = Number(created) * 1000;
    if (!session || !name || !cwd || !paneId || !startedAt || !Number.isFinite(startedAt)) continue;
    if (command !== 'codex' && !CODEX_NAME.test(name) && owner === '') continue;
    const id = `${session}:${created}`;
    const rank = dead === '1' ? 0 : command === 'codex' ? 2 : 1;
    if ((panes.get(id)?.rank ?? -1) >= rank) continue;
    panes.set(id, {
      rank,
      pane: {
        id,
        name,
        paneId,
        cwd,
        owner,
        startedAt,
        dead: dead === '1',
        endedAt: ended ? Number(ended) * 1000 || null : null,
      },
    });
  }
  return [...panes.values()].map(({ pane }) => pane);
}

function stateOf(lines: string[]): CodexRun['state'] {
  const footer = lines.slice(-8);
  if (footer.some((line) => !PROMPT.test(line) && INPUT_HINT.test(line))) return 'waiting for input';
  if (footer.some((line) => !PROMPT.test(line) && WORKING_HINT.test(line))) return 'running';
  return footer.some((line) => PROMPT.test(line)) ? 'waiting for input' : 'running';
}

export async function discoverRuns({
  tmux,
  scope,
  previous,
  now,
}: {
  tmux: Tmux;
  scope: Scope;
  previous: CodexRun[];
  now: number;
}): Promise<CodexRun[]> {
  const result = await tmux(['list-panes', '-a', '-F', PANE_FORMAT]);
  const oldRuns = previous.filter(
    (run) => visibleTo(run, scope) && (run.endedAt === null || now - run.endedAt < KEEP_ENDED_MS),
  );
  if (result.exitCode !== 0 && !/no server running|no such file or directory/i.test(result.stderr)) return oldRuns;

  const panes = codexPanes(result.stdout);
  const present = new Set(panes.map((pane) => pane.id));
  const oldById = new Map(oldRuns.map((run) => [run.id, run]));
  const current = await Promise.all(
    panes
      .filter((pane) => visibleTo(pane, scope))
      .map(async ({ paneId, dead, ...pane }): Promise<CodexRun> => {
        const capture = await tmux(['capture-pane', '-p', '-t', paneId, '-S', '-20']);
        const old = oldById.get(pane.id);
        const lines = capture.stdout
          .trimEnd()
          .split('\n')
          .filter((line) => line.trim() !== '');
        return {
          ...pane,
          endedAt: dead ? (pane.endedAt ?? old?.endedAt ?? now) : null,
          state: dead ? 'ended' : stateOf(capture.exitCode === 0 ? lines : (old?.tail ?? [])),
          tail: capture.exitCode === 0 ? lines.slice(-TAIL_LINES) : (old?.tail ?? []),
        };
      }),
  );
  const ended = oldRuns
    .filter((run) => !present.has(run.id))
    .map((run): CodexRun => ({ ...run, state: 'ended', endedAt: run.endedAt ?? now }));
  return [...current, ...ended]
    .filter((run) => run.endedAt === null || now - run.endedAt < KEEP_ENDED_MS)
    .sort((a, b) => b.startedAt - a.startedAt || a.name.localeCompare(b.name));
}

export function durationOf(run: CodexRun, now: number): string {
  const seconds = Math.max(0, Math.floor(((run.endedAt ?? now) - run.startedAt) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
