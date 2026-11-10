import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '../../content/skills/agent-sessions/agent-sessions.mjs');

const hasTmux = spawnSync('tmux', ['-V']).status === 0;

describe('agent-sessions', () => {
  let dir: string;

  const run = (args: string[], input?: string, env: NodeJS.ProcessEnv = {}) =>
    spawnSync('node', [SCRIPT, ...args], {
      cwd: dir,
      input,
      encoding: 'utf8',
      env: { ...process.env, TMUX_PANE: '', AGENT_MAILBOX: join(dir, 'mailbox.jsonl'), ...env },
    });

  const paneOf = (session: string) =>
    spawnSync('tmux', ['list-panes', '-t', `=${session}:`, '-F', '#{pane_id}'], { encoding: 'utf8' }).stdout.trim();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-mailbox-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sends a message from the arguments and reads it back', () => {
    run(['send', 'codex', 'hello', 'there']);

    expect(run(['read']).stdout).toMatch(/codex: hello there\n$/);
  });

  it('sends a multi-line message from stdin', () => {
    run(['send', 'codex'], 'line one\nline two\n');

    expect(run(['read']).stdout).toContain('codex: line one\nline two');
  });

  it('limits read to the last messages unless --all is given', () => {
    for (const n of [1, 2, 3]) run(['send', 'codex', `m${n}`]);

    expect(run(['read', '--last', '1']).stdout).toMatch(/m3/);
    expect(run(['read', '--last', '1']).stdout).not.toMatch(/m2/);
    expect(run(['read', '--all']).stdout).toMatch(/m1/);
  });

  it('lists a claim and refuses an overlapping claim from another sender', () => {
    run(['claim', 'codex', 'src/a']);

    expect(run(['claims']).stdout).toContain('src/a  codex');

    const conflict = run(['claim', 'claude', 'src/a/file.ts']);

    expect(conflict.status).toBe(2);
    expect(conflict.stderr).toContain('Claimed by codex');
    expect(run(['claim', 'claude', 'src/a/file.ts', '--force']).status).toBe(0);
  });

  it('drops a claim after release and after expiry', () => {
    run(['claim', 'codex', 'src/a']);
    run(['release', 'codex', 'src/a']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');

    run(['claim', 'codex', 'src/b', '--ttl', '0']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');
  });

  it('releases every claim of a sender when no path is given', () => {
    run(['claim', 'codex', 'src/a', 'src/b']);
    run(['release', 'codex']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');
  });

  it('shows each message in the inbox once and skips the own messages', () => {
    run(['send', 'codex', 'first']);
    run(['send', 'gemini', 'mine']);

    expect(run(['inbox', 'gemini']).stdout).toMatch(/codex: first\n$/);
    expect(run(['inbox', 'gemini']).stdout).toBe('No new messages.\n');

    run(['send', 'codex', 'second']);

    const next = run(['inbox', 'gemini']).stdout;

    expect(next).toContain('second');
    expect(next).not.toContain('first');
  });

  it('keeps a separate cursor for each sender', () => {
    run(['send', 'codex', 'hello']);
    run(['inbox', 'gemini']);

    expect(run(['inbox', 'claude']).stdout).toContain('codex: hello');
  });

  it('prints the unread messages when a claim is made', () => {
    run(['send', 'codex', 'please wait']);

    expect(run(['claim', 'gemini', 'src/a']).stdout).toContain('codex: please wait');
  });

  it('returns from inbox --wait when a message arrives', async () => {
    const waiting = new Promise<string>((resolve) => {
      const child = spawn('node', [SCRIPT, 'inbox', 'gemini', '--wait', '20'], {
        cwd: dir,
        env: { ...process.env, AGENT_MAILBOX: join(dir, 'mailbox.jsonl') },
      });
      let out = '';
      child.stdout.on('data', (chunk) => (out += chunk));
      child.on('close', () => resolve(out));
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    run(['send', 'codex', 'ping']);

    expect(await waiting).toContain('codex: ping');
  });

  it('gives up inbox --wait when no message arrives', () => {
    expect(run(['inbox', 'gemini', '--wait', '1']).stdout).toBe('No new messages.\n');
  });

  it.skipIf(!hasTmux)(
    'wakes the tmux session of the recipient for a message sent --to it',
    async () => {
      const session = `mailbox-spec-${process.pid}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', session, `cat > ${log}`]);

      const dispatch = spawn('node', [SCRIPT, 'dispatch'], {
        cwd: dir,
        env: { ...process.env, AGENT_MAILBOX: join(dir, 'mailbox.jsonl') },
      });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        run(['send', 'codex', '--to', session, 'hello']);
        await new Promise((resolve) => setTimeout(resolve, 4500));

        expect(readFileSync(log, 'utf8')).toContain(`inbox ${session}`);
      } finally {
        dispatch.kill();
        spawnSync('tmux', ['kill-session', '-t', session]);
      }
    },
    10000,
  );

  it.skipIf(!hasTmux)(
    'does not wake a session whose inbox already holds the message',
    async () => {
      const session = `mailbox-spec-read-${process.pid}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', session, `cat > ${log}`]);

      const dispatch = spawn('node', [SCRIPT, 'dispatch'], {
        cwd: dir,
        env: { ...process.env, AGENT_MAILBOX: join(dir, 'mailbox.jsonl') },
      });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        run(['send', 'codex', '--to', session, 'hello']);
        expect(run(['inbox', session]).stdout).toContain('hello');
        await new Promise((resolve) => setTimeout(resolve, 4500));

        expect(readFileSync(log, 'utf8')).not.toContain('inbox');
      } finally {
        dispatch.kill();
        spawnSync('tmux', ['kill-session', '-t', session]);
      }
    },
    10000,
  );

  it('builds a builder run with the role env and a quoted system prompt for claude', () => {
    const result = run(['run', 'claude', 'claude', '--role', 'builder', '--dry-run']);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "ETHLETE_AGENT_ROLE=builder 'claude' '--append-system-prompt' 'The user does not read this chat. Write no text between tool calls; end each turn with at most one line. Reports go to the grill session via SendMessage.'\n",
    );
  });

  it('adds no system prompt for another program and rejects an unknown role', () => {
    expect(run(['run', 'codex', 'codex', '--role', 'builder', '--dry-run']).stdout).toBe(
      "ETHLETE_AGENT_ROLE=builder 'codex'\n",
    );
    expect(run(['run', 'claude', 'claude', '--role', 'x', '--dry-run']).status).toBe(1);
  });

  it.skipIf(!hasTmux)('starts and stops the tmux sessions for up and down', () => {
    const suffix = process.pid;
    const dispatchSession = `mailbox-dispatch-${suffix}`;
    const agent = `mailbox-agent-${suffix}`;
    const scoped = `${agent}@${basename(dir)}`;
    const env = {
      ...process.env,
      AGENT_MAILBOX: join(dir, 'mailbox.jsonl'),
      AGENT_MAILBOX_DISPATCH_SESSION: dispatchSession,
    };
    const has = (name: string) => spawnSync('tmux', ['has-session', '-t', `=${name}`]).status === 0;
    const mailbox = (...args: string[]) => spawnSync('node', [SCRIPT, ...args], { cwd: dir, env, encoding: 'utf8' });

    try {
      expect(mailbox('up', `${agent}=cat`).stdout).toContain(`Started ${scoped}`);
      expect(has(scoped)).toBe(true);
      expect(has(dispatchSession)).toBe(true);
      expect(mailbox('up', `${agent}=cat`).stdout).toContain(`Session ${scoped} already runs.`);

      mailbox('down', agent);

      expect(has(scoped)).toBe(false);
      expect(has(dispatchSession)).toBe(false);
    } finally {
      spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      spawnSync('tmux', ['kill-session', '-t', `=${dispatchSession}`]);
    }
  });

  it.skipIf(!hasTmux)(
    'wakes the repo-scoped session before a plain one',
    async () => {
      const agent = `mailbox-scoped-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, `cat > ${log}`]);

      const dispatch = spawn('node', [SCRIPT, 'dispatch'], {
        cwd: dir,
        env: { ...process.env, AGENT_MAILBOX: join(dir, 'mailbox.jsonl') },
      });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        run(['send', 'codex', '--to', agent, 'hello']);
        await new Promise((resolve) => setTimeout(resolve, 4500));

        expect(readFileSync(log, 'utf8')).toContain(`inbox ${agent}`);
      } finally {
        dispatch.kill();
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    10000,
  );

  it.skipIf(!hasTmux)(
    'types the clear command and the prompt into the session for restart',
    async () => {
      const agent = `claude-restart-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, `cat > ${log}`]);

      try {
        expect(
          run(['restart', agent, '--after', '1', 'resume', 'slug'], undefined, { TMUX_PANE: paneOf(scoped) }).stdout,
        ).toContain('Restarting');

        await expect
          .poll(() => readFileSync(log, 'utf8'), { timeout: 20_000, interval: 250 })
          .toMatch(/\/clear\s+resume slug/);
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'types the prompt when a message wakes the session right after the clear',
    async () => {
      const agent = `claude-busy-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, `read line; echo "esc to interrupt"; cat > ${log}`]);

      try {
        run(['restart', agent, '--now', '--after', '0', 'resume', 'slug'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_CLEAR_WAIT_MS: '3000',
        });

        await expect.poll(() => readFileSync(log, 'utf8'), { timeout: 5_000, interval: 250 }).toContain('resume slug');
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'ends the agent and starts its command again with the prompt for restart --process',
    async () => {
      const agent = `claude-process-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const exited = join(dir, 'exited.log');
      const started = join(dir, 'started.log');
      const fakeAgent = join(dir, 'fake-agent.sh');
      writeFileSync(fakeAgent, `printf '%s\\n' "$*" > ${started}; exec cat\n`);

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, `read line; echo "$line" > ${exited}`]);
      spawnSync('tmux', ['set-option', '-t', `=${scoped}:`, '@ethlete_command', `sh ${fakeAgent}`]);

      try {
        run(['restart', agent, '--now', '--after', '0', '--process', '/handoff', 'resume', 'slug'], undefined, {
          TMUX_PANE: paneOf(scoped),
          SHELL: 'sh',
        });

        expect(readFileSync(exited, 'utf8')).toBe('/exit\n');
        await expect
          .poll(() => (existsSync(started) ? readFileSync(started, 'utf8') : ''), { timeout: 5_000, interval: 250 })
          .toBe('/handoff resume slug\n');
        expect(
          spawnSync('tmux', ['display-message', '-p', '-t', `=${scoped}:`, '#{pane_dead}'], { encoding: 'utf8' })
            .stdout,
        ).toBe('0\n');
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'types the prompt when only the IDE context chip sits on the prompt line',
    async () => {
      const agent = `claude-chip-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const log = join(dir, 'pane.log');

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, `read line; echo "❯ [⧉ In merged.json]"; cat > ${log}`]);

      try {
        run(['restart', agent, '--now', '--after', '0', 'resume', 'slug'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_CLEAR_WAIT_MS: '3000',
        });

        await expect.poll(() => readFileSync(log, 'utf8'), { timeout: 5_000, interval: 250 }).toContain('resume slug');
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'saves the prompt and logs why when the prompt holds typed text after the clear',
    async () => {
      const agent = `claude-draft-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, 'read line; echo "❯ half a sentence"; cat']);

      try {
        run(['restart', agent, '--now', '--after', '0', 'resume', 'slug'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_CLEAR_WAIT_MS: '3000',
        });

        expect(readFileSync(join(dir, 'restart.log'), 'utf8')).toMatch(/waits, draft: half a sentence/);
        expect(readFileSync(join(dir, `restart.prompt.${scoped}.txt`), 'utf8')).toBe('resume slug\n');
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  const panelPane = (log: string) => {
    const fixture = join(__dirname, 'fixtures/claude-pane-agent-panel.txt');
    const program = join(dir, 'pane.js');

    writeFileSync(
      program,
      `const fs = require('fs');
const pane = fs.readFileSync(${JSON.stringify(fixture)}, 'utf8');
let focused = true;
const draw = () => process.stdout.write('\\x1b[2J\\x1b[H' + (focused ? pane : pane.replace('❯ ⏺', '  ⏺')));
draw();
process.stdin.setRawMode(true);
process.stdin.on('data', (data) => {
  fs.appendFileSync(${JSON.stringify(log)}, data);
  if (focused && data.includes('\\x1b[A')) { focused = false; draw(); }
});`,
    );
    return `node ${program}`;
  };

  it.skipIf(!hasTmux)(
    'leaves the agent panel before it types the clear and the prompt into a captured pane',
    async () => {
      const agent = `claude-panel-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;
      const log = join(dir, 'pane.log');
      writeFileSync(log, '');

      spawnSync('tmux', ['new-session', '-d', '-x', '120', '-y', '30', '-s', scoped, panelPane(log)]);

      try {
        run(['restart', agent, '--now', '--after', '1', 'resume', 'slug'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_CLEAR_WAIT_MS: '3000',
        });

        const typed = readFileSync(log, 'utf8');
        expect(['\x1b[A', '\x1bOA'].some((up) => typed.startsWith(`${up}\x15/clear\r`))).toBe(true);
        expect(typed.endsWith('resume slug\r')).toBe(true);
        expect(existsSync(join(dir, 'restart.log'))).toBe(false);
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'treats a pane that waits for background agents as busy',
    () => {
      const agent = `claude-waiting-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, 'echo "Waiting for 2 background agents"; cat']);

      try {
        const result = run(['restart', agent, '--now', '--after', '0', 'resume'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_WAIT_MS: '2000',
        });

        expect(result.status).toBe(1);
        expect(readFileSync(join(dir, 'restart.log'), 'utf8')).toMatch(/waits, busy: Waiting for 2 background agents/);
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  const restartOverFixture = (name: string, fixture: string) => {
    const agent = `claude-${name}-${process.pid}`;
    const scoped = `${agent}@${basename(dir)}`;

    spawnSync('tmux', ['new-session', '-d', '-s', scoped, `cat ${join(__dirname, 'fixtures', fixture)}; cat`]);

    try {
      const result = run(['restart', agent, '--now', '--after', '0', 'resume'], undefined, {
        TMUX_PANE: paneOf(scoped),
        AGENT_RESTART_WAIT_MS: '6000',
        AGENT_RESTART_CLEAR_WAIT_MS: '1000',
      });
      const log = readFileSync(join(dir, 'restart.log'), 'utf8');
      return { result, log };
    } finally {
      spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
    }
  };

  it.skipIf(!hasTmux)(
    'treats a captured pane with a spinner line above the input box as busy',
    () => {
      const { result, log } = restartOverFixture('real-busy', 'claude-pane-busy.txt');

      expect(result.status).toBe(1);
      expect(log).toMatch(/waits, busy: ✻ Waiting for 1 background agent to finish/);
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'treats a captured idle pane with a "Waiting for" transcript line as idle',
    () => {
      const { log } = restartOverFixture('real-idle', 'claude-pane-idle-waiting-text.txt');

      expect(log).not.toMatch(/busy:/);
      expect(log).not.toMatch(/gave up after/);
    },
    30_000,
  );

  it.skipIf(!hasTmux)(
    'tells the caller and each --notify agent when a draft blocks the restart and when it gives up',
    () => {
      const agent = `claude-notice-${process.pid}`;
      const scoped = `${agent}@${basename(dir)}`;

      spawnSync('tmux', ['new-session', '-d', '-s', scoped, 'echo "❯ half a sentence"; cat']);

      try {
        const result = run(['restart', agent, '--now', '--after', '0', '--notify', 'grill', 'resume'], undefined, {
          TMUX_PANE: paneOf(scoped),
          AGENT_RESTART_WAIT_MS: '5000',
          AGENT_RESTART_DRAFT_NOTICE_MS: '1000',
        });

        expect(result.status).toBe(1);
        const notices = readFileSync(join(dir, 'mailbox.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as { to: string; message: string });
        expect(notices.map(({ to, message }) => `${to}: ${message.replace(/waits \d+s/, 'waits Ns')}`)).toEqual([
          `${agent}: restart of ${scoped} waits Ns, draft: half a sentence`,
          `grill: restart of ${scoped} waits Ns, draft: half a sentence`,
          `${agent}: restart of ${scoped} gave up after 5s, reason in restart.log`,
          `grill: restart of ${scoped} gave up after 5s, reason in restart.log`,
        ]);
      } finally {
        spawnSync('tmux', ['kill-session', '-t', `=${scoped}`]);
      }
    },
    30_000,
  );

  it.skipIf(!hasTmux)('refuses to restart a session the caller does not run in', () => {
    const target = `claude-target-${process.pid}`;
    const caller = `claude-caller-${process.pid}`;
    const scopedTarget = `${target}@${basename(dir)}`;
    const scopedCaller = `${caller}@${basename(dir)}`;

    spawnSync('tmux', ['new-session', '-d', '-s', scopedTarget, 'cat']);
    spawnSync('tmux', ['new-session', '-d', '-s', scopedCaller, 'cat']);

    try {
      const result = run(['restart', target, '--after', '1', 'resume'], undefined, { TMUX_PANE: paneOf(scopedCaller) });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`You run in ${scopedCaller}, so pass ${caller}`);
    } finally {
      spawnSync('tmux', ['kill-session', '-t', `=${scopedTarget}`]);
      spawnSync('tmux', ['kill-session', '-t', `=${scopedCaller}`]);
    }
  });

  it.skipIf(!hasTmux)('restarts the paired builder session and logs who restarted whom', () => {
    const builder = `claude-builder-${process.pid}`;
    const doc = `claude-doc-${process.pid}`;
    const scopedBuilder = `${builder}@${basename(dir)}`;
    const scopedDoc = `${doc}@${basename(dir)}`;

    spawnSync('tmux', ['new-session', '-d', '-s', scopedBuilder, 'cat']);
    spawnSync('tmux', ['new-session', '-d', '-s', scopedDoc, 'cat']);
    spawnSync('tmux', ['set-option', '-t', `=${scopedBuilder}:`, '@ethlete_role', 'builder']);

    try {
      const result = run(['restart', builder, '--after', '30', 'resume'], undefined, { TMUX_PANE: paneOf(scopedDoc) });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Restarting');
      expect(readFileSync(join(dir, 'restart.log'), 'utf8')).toContain(
        `peer restart: ${scopedDoc} restarted ${scopedBuilder}`,
      );
    } finally {
      spawnSync('tmux', ['kill-session', '-t', `=${scopedBuilder}`]);
      spawnSync('tmux', ['kill-session', '-t', `=${scopedDoc}`]);
    }
  });

  it('fails restart when no tmux session exists for the agent', () => {
    const result = run(['restart', `nobody-${process.pid}`, 'resume']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No tmux session');
  });

  it('prints a shell function for each agent that falls back to the plain command', () => {
    const output = run(['shell-init', 'codex', 'gemini']).stdout;

    expect(output).toContain('codex() {');
    expect(output).toContain('gemini() {');
    expect(output).toContain('command gemini "$@"');
    expect(spawnSync('bash', ['-n'], { input: output }).status).toBe(0);
  });

  it('replaces a block written under the old agent-mailbox marker', () => {
    const file = join(dir, 'rc');
    writeFileSync(file, 'export A=1\n# >>> ethlete agent-mailbox >>>\nold() {}\n# <<< ethlete agent-mailbox <<<\n');

    run(['shell-install', 'claude', '--file', file]);

    const installed = readFileSync(file, 'utf8');
    expect(installed).not.toContain('agent-mailbox >>>');
    expect(installed).not.toContain('old() {}');
    expect(installed.match(/>>> ethlete agent-sessions/g)).toHaveLength(1);
  });

  it('writes the shell functions once, replaces them on a second run and removes them', () => {
    const rc = join(dir, 'rc');
    writeFileSync(rc, 'export A=1\n');

    run(['shell-install', 'codex', '--file', rc]);
    run(['shell-install', 'codex', 'gemini', '--file', rc]);

    const installed = readFileSync(rc, 'utf8');

    expect(installed).toContain('export A=1');
    expect(installed.match(/>>> ethlete agent-sessions/g)).toHaveLength(1);
    expect(installed).toContain('gemini() {');

    run(['shell-install', '--remove', '--file', rc]);

    expect(readFileSync(rc, 'utf8')).toBe('export A=1\n');
  });
});
