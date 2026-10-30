import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, watchFile, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
const DEFAULT_TTL_HOURS = 4;
const DEFAULT_LAST = 20;
const ENTER_DELAY_MS = 400;
const DISPATCH_SESSION = process.env.AGENT_MAILBOX_DISPATCH_SESSION ?? 'mailbox-dispatch';

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
  const tmux = (...tmuxArgs) => spawnSync('tmux', tmuxArgs, { encoding: 'utf8' });
  const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
  const exists = (name) => tmux('has-session', '-t', `=${name}`).status === 0;
  const start = (name, shellCommand) => {
    if (exists(name)) return process.stdout.write(`Session ${name} already runs.\n`);
    const result = tmux('new-session', '-d', '-s', name, '-c', root, ...(shellCommand ? [shellCommand] : []));
    if (result.status !== 0) return process.stderr.write(`Could not start ${name}: ${result.stderr.trim()}\n`);
    process.stdout.write(`Started ${name}. Attach with: tmux attach -t ${name}\n`);
  };
  const withEnv = process.env.AGENT_MAILBOX ? `AGENT_MAILBOX=${quote(process.env.AGENT_MAILBOX)} ` : '';
  start(DISPATCH_SESSION, `${withEnv}node ${quote(script)} dispatch`);
  [sender, ...words].filter(Boolean).forEach((spec) => {
    const [name, ...rest] = spec.split('=');
    start(name, rest.join('=') || undefined);
  });
} else if (command === 'down') {
  [DISPATCH_SESSION, sender, ...words].filter(Boolean).forEach((name) => {
    const result = spawnSync('tmux', ['kill-session', '-t', `=${name}`], { encoding: 'utf8' });
    process.stdout.write(result.status === 0 ? `Stopped ${name}.\n` : `No session ${name}.\n`);
  });
} else if (command === 'dispatch') {
  prepare();
  appendFileSync(mailbox, '');
  let seen = entries().length;
  const wake = (agent) => {
    const text = `New mailbox message for ${agent}. Run: node ${script} inbox ${agent} and act on it.`;
    try {
      execFileSync('tmux', ['send-keys', '-t', agent, '-l', text], { stdio: 'ignore' });
      sleep(ENTER_DELAY_MS);
      execFileSync('tmux', ['send-keys', '-t', agent, 'Enter'], { stdio: 'ignore' });
      process.stdout.write(`Woke ${agent}.\n`);
    } catch {
      process.stderr.write(`No tmux session named ${agent}.\n`);
    }
  };
  const poll = () => {
    const history = entries();
    const fresh = history.slice(seen);
    seen = history.length;
    new Set(fresh.filter((entry) => entry.to && entry.to !== entry.sender).map((entry) => entry.to)).forEach(wake);
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
