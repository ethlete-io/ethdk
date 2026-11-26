import { describe, expect, it, vi } from 'vitest';

import { discoverRuns, durationOf } from '../../content/mods/plugins/codex-runs/hooks/progress';

const root = '/work/check';
const now = 1_795_733_620_000;
const first = ['$0', 'codex-a@check', '1795733600', root, '%0', '0', '', 'codex', 'claude-a'];
const second = ['$1', 'review@check', '1795733610', root, '%1', '0', '', 'codex', 'claude-b'];
const success = (stdout: string) => ({ stdout, stderr: '', exitCode: 0 });
const working = '• Working (50s • esc to interrupt)';
const scope = { sessionId: 'claude-a', root };

function tmuxWith(rows: string[][], captures: Record<string, string> = {}) {
  return vi.fn(async (args: string[]) =>
    success(args[0] === 'list-panes' ? rows.map((row) => row.join('\t')).join('\n') : (captures[args[3] ?? ''] ?? '')),
  );
}

describe('codex-runs discovery', () => {
  it('lists and captures only the run owned by the current Claude session', async () => {
    const tmux = tmuxWith([first, second], { '%0': working, '%1': '› Review my changes' });

    const a = await discoverRuns({ tmux, scope, previous: [], now });
    expect(a).toMatchObject([{ name: 'codex-a@check', state: 'running', tail: [working] }]);
    expect(tmux.mock.calls.filter(([args]) => args[0] === 'capture-pane')).toEqual([
      [['capture-pane', '-p', '-t', '%0', '-S', '-20']],
    ]);
    expect(durationOf(a[0]!, now)).toBe('20s');

    const b = await discoverRuns({ tmux, scope: { ...scope, sessionId: 'claude-b' }, previous: a, now });
    expect(b).toMatchObject([{ name: 'review@check', state: 'waiting for input', tail: ['› Review my changes'] }]);
  });

  it('uses the checkout for unowned runs and the owner for runs launched elsewhere', async () => {
    const tmux = tmuxWith([
      ['$2', 'codex-local@check', '1795733611', `${root}/src`, '%2', '0', '', 'codex', ''],
      ['$3', 'codex-foreign@check', '1795733612', `${root}-other`, '%3', '0', '', 'codex', ''],
      ['$4', 'codex-owned@other', '1795733613', '/work/other', '%4', '0', '', 'codex', 'claude-a'],
      ['$5', 'shell@check', '1795733614', root, '%5', '0', '', 'zsh', ''],
    ]);

    const runs = await discoverRuns({ tmux, scope, previous: [], now });
    expect(runs.map((run) => run.name)).toEqual(['codex-owned@other', 'codex-local@check']);
  });

  it('keeps the last output and freezes the duration when an observed run ends', async () => {
    const tmux = tmuxWith([first], { '%0': working });
    const previous = await discoverRuns({ tmux, scope, previous: [], now });
    tmux.mockResolvedValueOnce({ stdout: '', stderr: 'no server running on /tmp/tmux-1000/default', exitCode: 1 });

    const ended = await discoverRuns({ tmux, scope, previous, now: now + 5000 });
    expect(ended).toMatchObject([{ state: 'ended', endedAt: now + 5000, tail: [working] }]);
    expect(durationOf(ended[0]!, now + 120_000)).toBe('25s');
    expect(await discoverRuns({ tmux: tmuxWith([]), scope, previous: ended, now: now + 3_605_000 })).toEqual([]);
  });
});
