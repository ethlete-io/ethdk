import { atom, read, update } from 'claude-code';
import type { EngineInterface, Register, Timer } from 'claude-code';

import { discoverRuns, durationOf } from './progress';

const PANE = 'codex-runs';
const POLL_MS = 5000;
const PROCESS_TIMEOUT_MS = 2000;
const runs = atom({ plugin: 'codex-runs', key: 'runs' } as const, []);
const selected = atom({ plugin: 'codex-runs', key: 'selected' } as const, null);

let timer: Timer | undefined;
let pending: Promise<void> | undefined;

async function refresh($: EngineInterface) {
  const [sessionId, root, now, previous] = await Promise.all([
    $.session.id(),
    $.session.root(),
    $.clock.now(),
    read($, runs),
  ]);
  const checkout = await $.process
    .run(['git', 'rev-parse', '--show-toplevel'], { cwd: root, timeoutMs: PROCESS_TIMEOUT_MS })
    .catch(() => null);
  const next = await discoverRuns({
    tmux: (args) =>
      $.process
        .run(['tmux', ...args], { timeoutMs: PROCESS_TIMEOUT_MS })
        .catch(() => ({ exitCode: null, stdout: '', stderr: '' })),
    scope: { sessionId, root: checkout?.exitCode === 0 ? checkout.stdout.trimEnd() : root },
    previous,
    now,
  });
  if ((await $.session.id()) === sessionId) await update($, runs, () => next);
}

function poll($: EngineInterface) {
  pending ??= refresh($)
    .catch(() => undefined)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

async function runsForSession($: EngineInterface) {
  const [sessionId, shown] = await Promise.all([$.session.id(), read($, runs)]);
  return shown.filter((run) => !run.owner || run.owner === sessionId);
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: PANE,
      description: 'List Codex runs. Pass a run name to show its last output lines.',
    });
    timer?.cancel();
    timer = $.clock.every(POLL_MS, () => poll($));
    await poll($);
    return next(e);
  });

  on('command.run', { command: PANE }, async ($, e) => {
    await poll($);
    const name = e.args.trim();
    const run = name
      ? (await runsForSession($)).find((run) => run.name === name || run.name.startsWith(`${name}@`))
      : undefined;
    if (name && !run) return { text: `No visible Codex run named ${name}.` };

    await update($, selected, () => run?.id ?? null);
    await $.ui.open({ id: PANE, title: 'Codex runs' });
    return { text: run ? `Showing recent output for ${run.name}.` : 'Codex runs pane opened.' };
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const [shown, selectedId, now] = await Promise.all([runsForSession($), read($, selected), $.clock.now()]);
    if (shown.length === 0) return <Text dimColor>No Codex runs found.</Text>;

    const run = shown.find((run) => run.id === selectedId);
    return (
      <Box flexDirection="column">
        {shown.map((run) => (
          <Text key={run.id} wrap="truncate-end">
            {run.name} · {run.state} · {durationOf(run, now)}
          </Text>
        ))}
        {run && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{run.name} output</Text>
            {run.tail.length === 0 && <Text dimColor>No captured output.</Text>}
            {run.tail.map((line, index) => (
              <Text key={String(index)} wrap="truncate-end">
                {line}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    );
  });
};
