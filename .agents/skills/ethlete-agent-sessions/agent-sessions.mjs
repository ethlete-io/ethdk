import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, watchFile, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return process.cwd();
  }
})();
const mailbox = process.env.AGENT_MAILBOX ?? join(root, '.ethlete/mailbox.jsonl');
const script = fileURLToPath(import.meta.url);
const hasRootScript = (name) => {
  try {
    return Boolean(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts?.[name]);
  } catch {
    return false;
  }
};
const inboxCommand = (agent) => {
  if (existsSync(join(root, 'node_modules/.bin/ethlete-agents'))) return `npx ethlete-agents sessions inbox ${agent}`;
  if (hasRootScript('agents:sessions')) return `yarn agents:sessions inbox ${agent}`;
  return `node ${script} inbox ${agent}`;
};
const DEFAULT_TTL_HOURS = 4;
const DEFAULT_LAST = 20;
const ENTER_DELAY_MS = 400;
const WAKE_GRACE_MS = 1500;
const DRAFT_RETRY_MS = 2000;
const RESTART_AFTER_SECONDS = 5;
const RESTART_CLEAR_MS = 2500;
const repoSlug = basename(root).replace(/[.:]/g, '-');
const sessionFor = (agent) => `${agent}@${repoSlug}`;
const DISPATCH_SESSION = process.env.AGENT_MAILBOX_DISPATCH_SESSION ?? `mailbox-dispatch@${repoSlug}`;

const takeFlag = (args, name, hasValue) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const [flag, value] = args.splice(index, hasValue ? 2 : 1);
  return hasValue ? value : flag;
};

const args = process.argv.slice(2);
const last = takeFlag(args, '--last', true);
const ttl = takeFlag(args, '--ttl', true);
const all = takeFlag(args, '--all', false);
const force = takeFlag(args, '--force', false);
const waitSeconds = takeFlag(args, '--wait', true);
const recipient = takeFlag(args, '--to', true);
const rcFile = takeFlag(args, '--file', true);
const remove = takeFlag(args, '--remove', false);
const afterSeconds = takeFlag(args, '--after', true);
const now = takeFlag(args, '--now', false);
const dryRun = takeFlag(args, '--dry-run', false);
const [command, sender, ...words] = args;

const help = `Shared agent mailbox: ${mailbox}

Send:    node ${script} send <name> [--to <agent>] '<message>'   (no message: read it from stdin)
Inbox:   node ${script} inbox <name> [--wait <seconds>]   (only the messages you have not seen yet;
                                                           --wait blocks until one arrives or the time ends)
Read:    node ${script} read [--last <n>] [--all]     (default: the last ${DEFAULT_LAST} messages)
Watch:   node ${script} watch <name>
Claim:   node ${script} claim <name> <path...> [--ttl <hours>] [--force]
Release: node ${script} release <name> [path...]      (no path: release every claim of <name>)
Claims:  node ${script} claims
Up:      node ${script} up <name>[=<command>]...      (start a tmux session per agent, plus one that runs dispatch)
Run:     node ${script} run <name> <command...>       (start or attach the agent in its tmux session; starts dispatch)
Install: node ${script} shell-install [<agent>...] [--file <path>] [--remove] [--dry-run]
                                                      (write the shell functions into ~/.zshrc or ~/.bashrc)
Shell:   node ${script} shell-init [<agent>...]       (print shell functions that wrap each agent with run; default: claude codex)
Restart: node ${script} restart <name> [--after <seconds>] <prompt...>
                                                      (type the clear command and then the prompt into the tmux session of <name>)
Down:    node ${script} down [<name>...]              (stop dispatch; stop the named sessions too)
Dispatch: node ${script} dispatch                      (wake the tmux session named <agent> for each message sent --to <agent>)

Protocol: append one JSON object per line; never rewrite or truncate.
Fields: timestamp (UTC), sender, message. A claim also has paths and expires.
Pick a sender name no other agent uses. Claim the paths you edit before you edit them.
A claim is advisory, not a lock: it expires after ${DEFAULT_TTL_HOURS} hours unless --ttl says otherwise.
Silence is not approval. Acknowledge handoffs explicitly.
Watch prints existing messages and then new messages from other senders every second.
Keep credentials and personal data out of the mailbox. No agent is started automatically.
`;

const tmux = (...tmuxArgs) => spawnSync('tmux', tmuxArgs, { encoding: 'utf8' });
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
const sessionExists = (name) => tmux('has-session', '-t', `=${name}`).status === 0;

/**
 * Reads the last prompt line (`❯` for Claude Code, `›` for Codex) of the pane. Dim text is the empty
 * prompt's placeholder, so it does not count. A menu cursor (`❯ 1. Yes`) also counts, which keeps a
 * wake-up line from answering a permission dialog.
 */
const SGR = `${String.fromCharCode(27)}\\[([0-9;]*)m`;
const hasDraft = (session) => {
  const pane = tmux('capture-pane', '-p', '-e', '-t', `=${session}:`).stdout ?? '';
  const prompt = pane
    .split('\n')
    .reverse()
    .find((line) => /^\s*[❯›]/.test(line.replace(new RegExp(SGR, 'g'), '')));
  if (!prompt) return false;
  let dim = false;
  const visible = prompt
    .split(new RegExp(`(${SGR.replace('(', '(?:')})`))
    .map((part) => {
      const codes = part.match(new RegExp(`^${SGR}$`))?.[1].split(';');
      if (!codes) return dim ? '' : part;
      codes.forEach((code) => {
        if (code === '2') dim = true;
        if (code === '' || code === '0' || code === '22') dim = false;
      });
      return '';
    })
    .join('');
  return visible.replace(/^\s*[❯›]/, '').trim().length > 0;
};
const isAttached = (name) => tmux('list-clients', '-t', `=${name}`).stdout.trim() !== '';
const freeSessionFor = (agent) => {
  for (let number = 1; ; number++) {
    const session = sessionFor(number === 1 ? agent : `${agent}-${number}`);
    if (!sessionExists(session) || !isAttached(session)) return session;
  }
};
const startSession = (name, shellCommand, quiet = false) => {
  if (sessionExists(name)) return quiet ? undefined : process.stdout.write(`Session ${name} already runs.\n`);
  const result = tmux('new-session', '-d', '-s', name, '-c', root, ...(shellCommand ? [shellCommand] : []));
  if (result.status !== 0) return process.stderr.write(`Could not start ${name}: ${result.stderr.trim()}\n`);
  if (!quiet) process.stdout.write(`Started ${name}. Attach with: tmux attach -t ${name}\n`);
};

const IGNORED = ['mailbox.jsonl', 'mailbox.cursor.*'];

const prepare = () => {
  mkdirSync(dirname(mailbox), { recursive: true });
  if (process.env.AGENT_MAILBOX) return;
  const ignore = join(dirname(mailbox), '.gitignore');
  const present = existsSync(ignore) ? readFileSync(ignore, 'utf8') : '';
  const missing = IGNORED.filter((line) => !present.split('\n').includes(line));
  if (missing.length)
    writeFileSync(ignore, `${present && !present.endsWith('\n') ? `${present}\n` : present}${missing.join('\n')}\n`);
};

const append = (entry) => {
  prepare();
  appendFileSync(mailbox, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`, 'utf8');
};

const parse = (line) => {
  if (!line.trim()) return undefined;
  try {
    return JSON.parse(line);
  } catch {
    process.stderr.write('Ignoring malformed mailbox line.\n');
    return undefined;
  }
};

const entries = () => (existsSync(mailbox) ? readFileSync(mailbox, 'utf8').split('\n').map(parse).filter(Boolean) : []);

const show = (entry) => process.stdout.write(`[${entry.timestamp}] ${entry.sender}: ${entry.message}\n`);

const inboxCursor = (reader) => join(dirname(mailbox), `mailbox.cursor.${reader}`);

const unreadFor = (reader) => {
  const cursor = inboxCursor(reader);
  const history = entries();
  const seen = existsSync(cursor) ? Number(readFileSync(cursor, 'utf8')) : history.length - DEFAULT_LAST;
  return { count: history.length, unread: history.slice(Math.max(0, seen)).filter((entry) => entry.sender !== reader) };
};

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const showInbox = (reader, waitFor = 0) => {
  const deadline = Date.now() + waitFor * 1000;
  let { count, unread } = unreadFor(reader);
  while (!unread.length && Date.now() < deadline) {
    sleep(1000);
    ({ count, unread } = unreadFor(reader));
  }
  if (!unread.length) process.stdout.write('No new messages.\n');
  unread.forEach(show);
  prepare();
  writeFileSync(inboxCursor(reader), String(count));
};

const toRepoPath = (path) => relative(root, resolve(path)).split('\\').join('/');

const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

const activeClaims = () => {
  const now = Date.now();
  const claims = [];
  for (const entry of entries()) {
    if (entry.type === 'claim') {
      for (const path of entry.paths) claims.push({ sender: entry.sender, path, expires: entry.expires });
    } else if (entry.type === 'release') {
      for (let index = claims.length - 1; index >= 0; index--) {
        const claim = claims[index];
        const released = !entry.paths?.length || entry.paths.some((path) => overlaps(path, claim.path));
        if (claim.sender === entry.sender && released) claims.splice(index, 1);
      }
    }
  }
  return claims.filter((claim) => Date.parse(claim.expires) > now);
};

if (command === 'send' && sender) {
  const message = words.length ? words.join(' ') : process.stdin.isTTY ? '' : readFileSync(0, 'utf8').trim();
  if (!message) {
    process.stderr.write('No message given.\n');
    process.exitCode = 1;
  } else {
    append({ sender, message, ...(recipient ? { to: recipient } : {}) });
    process.stdout.write(`Sent as ${sender}.\n`);
  }
} else if (command === 'up') {
  const withEnv = process.env.AGENT_MAILBOX ? `AGENT_MAILBOX=${quote(process.env.AGENT_MAILBOX)} ` : '';
  startSession(DISPATCH_SESSION, `${withEnv}node ${quote(script)} dispatch`);
  [sender, ...words].filter(Boolean).forEach((spec) => {
    const [name, ...rest] = spec.split('=');
    startSession(sessionFor(name), rest.join('=') || undefined);
  });
} else if (command === 'run' && sender && words.length) {
  const withEnv = process.env.AGENT_MAILBOX ? `AGENT_MAILBOX=${quote(process.env.AGENT_MAILBOX)} ` : '';
  if (!sessionExists(DISPATCH_SESSION))
    startSession(DISPATCH_SESSION, `${withEnv}node ${quote(script)} dispatch`, true);
  const session = freeSessionFor(sender);
  const shellCommand = words.map(quote).join(' ');
  if (process.env.TMUX) {
    if (!sessionExists(session)) tmux('new-session', '-d', '-s', session, '-c', process.cwd(), shellCommand);
    process.exitCode = spawnSync('tmux', ['switch-client', '-t', `=${session}`], { stdio: 'inherit' }).status ?? 1;
  } else {
    process.exitCode =
      spawnSync('tmux', ['new-session', '-A', '-s', session, '-c', process.cwd(), shellCommand], { stdio: 'inherit' })
        .status ?? 1;
  }
} else if (command === 'shell-init' || command === 'shell-install') {
  const agents = [sender, ...words].filter(Boolean);
  const functions = (agents.length ? agents : ['claude', 'codex'])
    .map(
      (agent) => `${agent}() {
  local root script
  root=$(git rev-parse --show-toplevel 2>/dev/null) && script="$root/.agents/skills/ethlete-agent-sessions/agent-sessions.mjs"
  if [ -n "$script" ] && [ -f "$script" ] && command -v tmux >/dev/null; then
    node "$script" run ${agent} ${agent} "$@"
  else
    command ${agent} "$@"
  fi
}
`,
    )
    .join('');
  if (command === 'shell-init') {
    process.stdout.write(functions);
  } else {
    const shell = basename(process.env.SHELL ?? '');
    const file = rcFile ?? (shell === 'zsh' ? '.zshrc' : shell === 'bash' ? '.bashrc' : undefined);
    if (!file) {
      process.stderr.write('Unknown shell. Pass --file <path> to the startup file.\n');
      process.exitCode = 1;
    } else {
      const path = rcFile ? resolve(rcFile) : join(homedir(), file);
      const present = existsSync(path) ? readFileSync(path, 'utf8') : '';
      const start = '# >>> ethlete agent-sessions >>>';
      const end = '# <<< ethlete agent-sessions <<<';
      const without = ['agent-mailbox', 'agent-sessions']
        .reduce(
          (text, name) =>
            text.replace(new RegExp(`\\n?# >>> ethlete ${name} >>>[\\s\\S]*?# <<< ethlete ${name} <<<\\n?`), '\n'),
          present,
        )
        .replace(/\n+$/, '\n');
      const block = `${start}\n${functions}${end}\n`;
      const next = remove ? without : `${without}\n${block}`;
      if (dryRun) {
        process.stdout.write(`Would write ${path}:\n${remove ? '(block removed)\n' : block}`);
      } else {
        writeFileSync(path, next);
        process.stdout.write(
          `${remove ? 'Removed the block from' : 'Wrote the block to'} ${path}. Open a new terminal.\n`,
        );
      }
    }
  }
} else if (command === 'restart' && sender && words.length) {
  const session = [sessionFor(sender), sender].find(sessionExists);
  if (!session) {
    process.stderr.write(`No tmux session for ${sender}.\n`);
    process.exitCode = 1;
  } else if (now) {
    const type = (...keys) => tmux('send-keys', '-t', `=${session}:`, ...keys);
    sleep(Number(afterSeconds ?? RESTART_AFTER_SECONDS) * 1000);
    type('-l', sender.startsWith('codex') ? '/new' : '/clear');
    sleep(ENTER_DELAY_MS);
    type('Enter');
    sleep(RESTART_CLEAR_MS);
    type('-l', words.join(' '));
    sleep(ENTER_DELAY_MS);
    type('Enter');
  } else {
    const delay = Number(afterSeconds ?? RESTART_AFTER_SECONDS);
    spawn(process.execPath, [script, 'restart', sender, '--now', '--after', String(delay), ...words], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    process.stdout.write(`Restarting ${session} in ${delay} seconds. End your turn now.\n`);
  }
} else if (command === 'down') {
  [DISPATCH_SESSION, ...[sender, ...words].filter(Boolean).map(sessionFor)].forEach((name) => {
    const result = tmux('kill-session', '-t', `=${name}`);
    process.stdout.write(result.status === 0 ? `Stopped ${name}.\n` : `No session ${name}.\n`);
  });
} else if (command === 'dispatch') {
  prepare();
  appendFileSync(mailbox, '');
  let seen = entries().length;
  const due = {};
  const waiting = new Set();
  const wake = (agent) => {
    if (!unreadFor(agent).unread.length) return;
    const text = `New mailbox message for ${agent}. Run: ${inboxCommand(agent)}`;
    const session = [sessionFor(agent), agent].find(sessionExists);
    if (!session) return process.stderr.write(`No tmux session for ${agent}.\n`);
    if (hasDraft(session)) {
      if (!waiting.has(agent)) process.stdout.write(`Waiting for the typed text in ${session}.\n`);
      waiting.add(agent);
      due[agent] = Date.now() + DRAFT_RETRY_MS;
      return;
    }
    waiting.delete(agent);
    spawnSync('tmux', ['send-keys', '-t', `=${session}:`, '-l', text]);
    sleep(ENTER_DELAY_MS);
    spawnSync('tmux', ['send-keys', '-t', `=${session}:`, 'Enter']);
    process.stdout.write(`Woke ${session}.\n`);
  };
  const poll = () => {
    const history = entries();
    const fresh = history.slice(seen);
    seen = history.length;
    fresh
      .filter((entry) => entry.to && entry.to !== entry.sender)
      .forEach((entry) => (due[entry.to] ??= Date.now() + WAKE_GRACE_MS));
    Object.keys(due)
      .filter((agent) => due[agent] <= Date.now())
      .forEach((agent) => {
        delete due[agent];
        wake(agent);
      });
  };
  process.stdout.write(`Dispatching for ${resolve(mailbox)}\n`);
  setInterval(poll, 1000);
} else if (command === 'inbox' && sender) {
  showInbox(sender, Number(waitSeconds ?? 0));
} else if (command === 'read') {
  const history = entries();
  (all ? history : history.slice(-Number(last ?? DEFAULT_LAST))).forEach(show);
} else if (command === 'claims') {
  const claims = activeClaims();
  if (!claims.length) process.stdout.write('No active claims.\n');
  claims.forEach((claim) => process.stdout.write(`${claim.path}  ${claim.sender}  until ${claim.expires}\n`));
} else if (command === 'claim' && sender && words.length) {
  showInbox(sender);
  const paths = words.map(toRepoPath);
  const conflicts = activeClaims().filter(
    (claim) => claim.sender !== sender && paths.some((path) => overlaps(path, claim.path)),
  );
  if (conflicts.length && !force) {
    conflicts.forEach((claim) =>
      process.stderr.write(`Claimed by ${claim.sender}: ${claim.path} until ${claim.expires}\n`),
    );
    process.stderr.write('Ask for a handoff, or pass --force to claim anyway.\n');
    process.exitCode = 2;
  } else {
    const hours = ttl === undefined ? DEFAULT_TTL_HOURS : Number(ttl);
    const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
    append({ sender, type: 'claim', paths, expires, message: `claims ${paths.join(', ')}` });
    process.stdout.write(`Claimed ${paths.join(', ')} as ${sender} until ${expires}.\n`);
  }
} else if (command === 'release' && sender) {
  const paths = words.map(toRepoPath);
  append({
    sender,
    type: 'release',
    paths,
    message: paths.length ? `releases ${paths.join(', ')}` : 'releases all claims',
  });
  process.stdout.write(`Released as ${sender}.\n`);
} else if (command === 'watch' && sender) {
  prepare();
  appendFileSync(mailbox, '');
  let consumed = 0;
  let pending = '';
  const update = () => {
    const contents = readFileSync(mailbox, 'utf8');
    if (contents.length < consumed) {
      process.stderr.write('Mailbox was truncated; restarting read.\n');
      consumed = 0;
      pending = '';
    }
    pending += contents.slice(consumed);
    consumed = contents.length;
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines
      .map(parse)
      .filter((entry) => entry && entry.sender !== sender)
      .forEach(show);
  };
  process.stdout.write(`Watching ${resolve(mailbox)} as ${sender}\n`);
  update();
  watchFile(mailbox, { interval: 1000 }, update);
} else {
  process.stdout.write(help);
  if (command && command !== '--help') process.exitCode = 1;
}
