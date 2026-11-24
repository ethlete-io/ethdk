import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  watchFile,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const WAKE_GRACE_MS = 1500;
const DRAFT_RETRY_MS = 2000;
const RESTART_AFTER_SECONDS = 5;
const RESTART_MARKER = ' [typed by agent-sessions]';
const restartPrompt = (words) => `${words.join(' ')}${RESTART_MARKER}`;
const RESTART_CLEAR_MS = 2500;
const RESTART_POLL_MS = 2000;
const RESTART_WAIT_MS = Number(process.env.AGENT_RESTART_WAIT_MS ?? 30 * 60 * 1000);
const RESTART_DRAFT_NOTICE_MS = Number(process.env.AGENT_RESTART_DRAFT_NOTICE_MS ?? 2 * 60 * 1000);
const RESTART_CLEAR_WAIT_MS = Number(process.env.AGENT_RESTART_CLEAR_WAIT_MS ?? 60 * 1000);
const RESTART_EXIT_WAIT_MS = Number(process.env.AGENT_RESTART_EXIT_WAIT_MS ?? 30 * 1000);
const RESTART_RESUME_WAIT_MS = Number(process.env.AGENT_RESTART_RESUME_WAIT_MS ?? 60 * 1000);
const RUN_EXIT_CHECK_MS = Number(process.env.AGENT_RUN_EXIT_CHECK_MS ?? 400);
const RESTART_LOCK_MS = Number(process.env.AGENT_RESTART_LOCK_MS ?? RESTART_WAIT_MS + 10 * 60 * 1000);
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
const role = takeFlag(args, '--role', true);
const notify = takeFlag(args, '--notify', true);
const newProcess = takeFlag(args, '--process', false);
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
Run:     node ${script} run <name> <command...> [--role builder] [--dry-run]
                                                      (start or attach the agent in its tmux session; starts dispatch;
                                                       the builder role sets ETHLETE_AGENT_ROLE and gives claude a terse system prompt)
Install: node ${script} shell-install [<agent>...] [--file <path>] [--remove] [--dry-run]
                                                      (write the shell functions into ~/.zshrc or ~/.bashrc)
Shell:   node ${script} shell-init [<agent>...]       (print shell functions that wrap each agent with run; default: claude codex)
Restart: node ${script} restart <name> [--after <seconds>] [--notify <agent,...>] [--process] [--role builder|none] <prompt...>
                                                      (type the clear command and then the prompt into the tmux session of <name>;
                                                       a long wait on a draft and a give-up go to <name> and each --notify agent;
                                                       --process ends the agent and starts it again in the same pane with the prompt;
                                                       it takes --role, else the role a builder-*/doc-agent-* handoff names, else keeps the role, and refuses
                                                       a session with no role while another agent session runs in the repo;
                                                       refuses while a ❓ question of a claude session has no later human message
                                                       and the resumed handoff does not name it under "Open for the human")
Down:    node ${script} down [<name>...]              (stop dispatch; stop the named sessions too)
Dispatch: node ${script} dispatch                      (wake the session <agent>@<repo> for each message sent --to <agent>)

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
const BUILDER_PROMPT =
  'The user does not read this chat. Write no text between tool calls; end each turn with at most one line. Reports go to the grill session via SendMessage.';
const BUILDER_DENIED_TOOLS =
  'Artifact Workflow ScheduleWakeup SendFeedback ShareOnboardingGuide ReportFindings AskUserQuestion';
const builderFlags = () => [
  '--append-system-prompt',
  BUILDER_PROMPT,
  '--strict-mcp-config',
  `--mcp-config=${join(root, '.mcp.json')}`,
  `--disallowedTools=${BUILDER_DENIED_TOOLS}`,
];
const claudeTmpDir = join(homedir(), '.cache', 'claude-tmp');
const ensuredClaudeTmpDir = () => {
  mkdirSync(claudeTmpDir, { recursive: true });
  return claudeTmpDir;
};
const tempDirEnv = () => `CLAUDE_CODE_TMPDIR=${quote(ensuredClaudeTmpDir())} `;
const withTempDir = (command) => (/(^|\s)CLAUDE_CODE_TMPDIR=/.test(command) ? command : `${tempDirEnv()}${command}`);
const programOf = (words) => words.find((word) => word !== 'env' && !ENV_WORD.test(word) && !word.startsWith('-'));
const withRole = (words) =>
  role === 'builder' && basename(programOf(words) ?? '') === 'claude' ? [...words, ...builderFlags()] : words;
const roleEnvOf = (agentRole) =>
  agentRole
    ? { ETHLETE_AGENT_ROLE: agentRole, ...(agentRole === 'builder' ? { CLAUDE_CODE_SILENT_TURN_REMINDER: '0' } : {}) }
    : {};
const roleEnvWords = (agentRole) => Object.entries(roleEnvOf(agentRole)).map(([key, value]) => `${key}=${value}`);
const sessionExists = (name) => tmux('has-session', '-t', `=${name}`).status === 0;
const ROLE_OPTION = '@ethlete_role';
const COMMAND_OPTION = '@ethlete_command';
const agentCommandOf = (session) =>
  tmux('show-options', '-v', '-t', `=${session}:`, COMMAND_OPTION).stdout.trim() ||
  tmux('display-message', '-p', '-t', `=${session}:`, '#{pane_start_command}')
    .stdout.trim()
    .replace(/^"(.*)"$/, '$1');
const roleOf = (session) => tmux('show-options', '-v', '-t', `=${session}:`, ROLE_OPTION).stdout.trim() || null;
const arePaired = (a, b) => (roleOf(a) === 'builder') !== (roleOf(b) === 'builder');
const checkoutOfSession = (session) => {
  const path = tmux('display-message', '-p', '-t', `=${session}:`, '#{pane_current_path}').stdout.trim();
  if (!path) return null;
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: path, encoding: 'utf8' });
  return top.status === 0 ? top.stdout.trim() : path;
};
const localSessionFor = (agent) =>
  [sessionFor(agent), agent].find(
    (name) => sessionExists(name) && (name === sessionFor(agent) || checkoutOfSession(name) === root),
  ) ?? null;
const foreignCheckoutsOf = (agent) => [
  ...new Set(
    tmux('list-sessions', '-F', '#{session_name}')
      .stdout.split('\n')
      .filter((name) => name === agent || name.startsWith(`${agent}@`))
      .map((name) => (name === agent ? basename(checkoutOfSession(name) ?? '') : name.slice(agent.length + 1)))
      .filter(Boolean),
  ),
];
const createRunSession = (session, shellCommand, baseCommand) => {
  const result = tmux(
    'new-session',
    '-d',
    '-s',
    session,
    '-c',
    process.cwd(),
    inAgentScopeCommand(shellCommand, session),
  );
  if (result.status !== 0) {
    process.stderr.write(`No agent was started: tmux could not create ${session}: ${result.stderr.trim()}\n`);
    process.exitCode = 1;
    return;
  }
  tmux('set-option', '-t', `=${session}:`, COMMAND_OPTION, baseCommand);
  if (role) tmux('set-option', '-t', `=${session}:`, ROLE_OPTION, role);
  sleep(RUN_EXIT_CHECK_MS);
  if (!sessionExists(session)) {
    process.stderr.write(`No agent stayed up: ${session} ended right after the start of ${baseCommand}\n`);
    process.exitCode = 1;
  }
};
const ownSession = () =>
  process.env.TMUX_PANE
    ? tmux('display-message', '-p', '-t', process.env.TMUX_PANE, '#{session_name}').stdout.trim() || null
    : null;
const ONE_SHOT_FLAGS = new Set(['-p', '--print', '-v', '--version', '-h', '--help']);
const hasTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const runsInSession = (agentArgs) => !agentArgs.some((arg) => ONE_SHOT_FLAGS.has(arg));
const TEXT_VALUE_FLAGS = new Set(['--append-system-prompt', '--system-prompt']);
const withoutPrompt = (words) => {
  const separator = words.indexOf('--');
  if (separator > 0) return words.slice(0, separator);
  const [previous, last] = words.slice(-2);
  let binary = 0;
  while (
    binary < words.length - 1 &&
    (ENV_WORD.test(words[binary]) ||
      words[binary] === 'env' ||
      (binary > 0 && words[0] === 'env' && words[binary].startsWith('-')))
  )
    binary++;
  const isPrompt =
    words.length - 1 > binary &&
    !last.startsWith('-') &&
    (!previous.startsWith('-') || (/\s/.test(last) && !TEXT_VALUE_FLAGS.has(previous)));
  return isPrompt ? words.slice(0, -1) : words;
};
const SHELL_WORD = /(?:'[^']*'|\\.|[^\s'\\])+/g;
const ENV_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/;
const CONFIG_WORD = 'CLAUDE_CONFIG_DIR=';
const callerConfigDir = () => resolve(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'));
const configDirOf = (words) => words.find((word) => word.startsWith(CONFIG_WORD))?.slice(CONFIG_WORD.length);
const configMismatch = (words) => {
  const given = configDirOf(words);
  return given !== undefined && resolve(given) !== callerConfigDir();
};
const callerConfigWords = (words) =>
  process.env.CLAUDE_CONFIG_DIR && configDirOf(words) === undefined
    ? [`${CONFIG_WORD}${quote(process.env.CLAUDE_CONFIG_DIR)}`]
    : [];
const unquoteWord = (word) => word.replace(/'([^']*)'|\\(.)/g, (_, quoted, escaped) => quoted ?? escaped);
const hasAgentBinary = (words) => {
  let index = 0;
  while (
    index < words.length &&
    (ENV_WORD.test(words[index]) ||
      words[index] === 'env' ||
      (index > 0 && words.includes('env') && words[index].startsWith('-')))
  )
    index++;
  return index < words.length;
};
const AGENT_PROGRAM = /^(?:claude|codex)$/;
const programIndexOf = (words) => {
  let index = 0;
  while (
    index < words.length &&
    (ENV_WORD.test(words[index]) ||
      words[index] === 'env' ||
      (index > 0 && words.includes('env') && words[index].startsWith('-')))
  )
    index++;
  return index;
};
const runsAgentProgram = (words) => {
  const index = programIndexOf(words);
  return index < words.length && AGENT_PROGRAM.test(basename(words[index]));
};
const quoteShellWord = (word) =>
  ENV_WORD.test(word) ? word.replace(/^([^=]+=)(.*)$/s, (_, key, value) => `${key}${quote(value)}`) : quote(word);
const unwrappedRun = (command) => {
  const tokens = [...command.matchAll(SHELL_WORD)].map(([word]) => word);
  const words = tokens.map(unquoteWord);
  const at = words.findIndex((word, index) => basename(word) === 'agent-sessions.mjs' && words[index + 1] === 'run');
  if (at < 0) return null;
  let rest = words.slice(at + 3);
  let runRole = null;
  while (rest[0]?.startsWith('--')) {
    if (rest[0] === '--role') runRole = rest[1];
    rest = rest.slice(rest[0] === '--role' ? 2 : 1);
  }
  const end = rest.findIndex((word) => /[;&|]$/.test(word));
  const inner = end < 0 ? rest : [...rest.slice(0, end), rest[end].replace(/[;&|]+$/, '')];
  const program = inner.findIndex((word) => !ENV_WORD.test(word));
  if (program < 0 || !runsAgentProgram(inner)) return null;
  const kept = [...inner.slice(0, program), ...withoutPrompt(inner.slice(program))];
  const env = tokens.slice(0, at).filter((word) => ENV_WORD.test(word));
  const unwrapped = [...env, ...kept.map(quoteShellWord)].join(' ');
  return runRole ? commandWithRole(unwrapped, runRole) : unwrapped;
};
const SHELL_WRAP =
  /^((?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|\S*)\s+)*)'?((?:\S*\/)?(?:sh|bash|zsh|dash))'?\s+'?(-[a-z]*c)'?\s+(.+)$/s;
const wrapOf = (command) => {
  const found = command.match(SHELL_WRAP);
  if (!found) return null;
  const [, head, shell, flag, rest] = found;
  const single = rest.match(/^'((?:[^']|'\\'')*)'$/s);
  const double = rest.match(/^"((?:[^"\\]|\\.)*)"$/s);
  const inner = single ? single[1].replaceAll("'\\''", "'") : double ? double[1].replace(/\\(["\\$`])/g, '$1') : rest;
  return { head, shell, flag, inner };
};
const wordsOf = (command) => [...command.matchAll(SHELL_WORD)].map(([word]) => unquoteWord(word));
const healedCommand = (command, agent) => {
  const unwrapped = unwrappedRun(command);
  if (unwrapped) return unwrapped;
  const wrap = wrapOf(command);
  if (wrap) return runsAgentProgram(wordsOf(wrap.inner)) ? command : null;
  const words = wordsOf(command);
  if (programIndexOf(words) < words.length) return runsAgentProgram(words) ? command : null;
  const binary = agent.match(/^(claude|codex)/)?.[1];
  return binary ? `${command} ${quote(binary)}` : null;
};
const rewrapped = (wrap, head, inner) => `${head}${wrap.shell} ${wrap.flag} ${quote(inner)}`;
const commandWithoutPrompt = (command) => {
  const wrap = wrapOf(command);
  if (wrap) {
    const innerRole = wrap.inner.match(/(?:^|\s)ETHLETE_AGENT_ROLE=(\w+)/)?.[1];
    const bare = commandWithoutPrompt(commandWithRole(wrap.inner, null));
    return rewrapped(wrap, wrap.head, innerRole ? commandWithRole(bare, innerRole) : bare);
  }
  const tokens = [...command.matchAll(SHELL_WORD)];
  const program = tokens.findIndex(([word]) => !ENV_WORD.test(word));
  if (program < 0) return command;
  const words = tokens.slice(program).map(([word]) => unquoteWord(word));
  const kept = withoutPrompt(words).length;
  return kept === words.length ? command : command.slice(0, tokens[program + kept].index).trimEnd();
};
const HANDOFF_ROLE = /^\/handoff\s+resume\s+(builder|doc-agent)-/;
const handoffRoleOf = (prompt) => prompt.match(HANDOFF_ROLE)?.[1] ?? null;
const restartRoleOf = (session, prompt) => {
  if (role === 'none') return null;
  const found = role ?? handoffRoleOf(prompt) ?? roleOf(session);
  return found === 'doc-agent' ? null : found;
};
const claudeDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};
const claudeSessionIdOf = (session, own) => {
  const sessionsDir = join(claudeDir, 'sessions');
  const live = existsSync(sessionsDir)
    ? readdirSync(sessionsDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => readJson(join(sessionsDir, name)))
        .filter((entry) => entry?.sessionId && entry.tmux?.startsWith(`${session}:`) && isAlive(entry.pid))
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    : [];
  if (live.length) return live[0].sessionId;
  return own === session ? process.env.CLAUDE_CODE_SESSION_ID || null : null;
};
const transcriptOf = (sessionId) => {
  const projects = join(claudeDir, 'projects');
  if (!existsSync(projects)) return null;
  return (
    readdirSync(projects)
      .map((project) => join(projects, project, `${sessionId}.jsonl`))
      .find((path) => existsSync(path)) ?? null
  );
};
const textOf = (content) =>
  typeof content === 'string'
    ? content
    : (content ?? [])
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n');
const isHumanTurn = (entry) =>
  entry.type === 'user' &&
  entry.origin?.kind === 'human' &&
  !/^\s*<command-(name|message)>/.test(textOf(entry.message?.content));
const QUESTION_LINE = /^\s*(?:[-*]\s+)?❓\s*(.+)$/;
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const unansweredQuestions = (transcript) => {
  let questions = [];
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (isHumanTurn(entry)) questions = [];
    else if (entry.type === 'assistant')
      textOf(entry.message?.content)
        .split('\n')
        .map((text) => text.match(QUESTION_LINE)?.[1])
        .filter(Boolean)
        .forEach((question) => questions.push(normalize(question)));
  }
  return [...new Set(questions)];
};
const HANDOFF_NAME = /^\/handoff\s+resume\s+(\S+)/;
const openForHumanOf = (prompt) => {
  const name = prompt.match(HANDOFF_NAME)?.[1];
  const path = name && join(root, '.claude/handoffs', name.endsWith('.md') ? name : `${name}.md`);
  if (!path || !existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex((line) => /open for the human/i.test(line));
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^#/.test(line));
  return normalize(lines.slice(start, end < 0 ? undefined : end).join('\n'));
};
const droppedQuestions = (session, own, prompt) => {
  if (session.startsWith('codex')) return [];
  const sessionId = claudeSessionIdOf(session, own);
  const transcript = sessionId && transcriptOf(sessionId);
  if (!transcript) return [];
  const open = openForHumanOf(prompt) ?? '';
  return unansweredQuestions(transcript).filter((question) => !open.includes(question));
};
const hasUnknownRole = (session, prompt) => {
  if (role !== undefined || roleOf(session) || handoffRoleOf(prompt)) return false;
  const peers = tmux('list-sessions', '-F', '#{session_name}')
    .stdout.split('\n')
    .filter((name) => name.endsWith(`@${repoSlug}`) && name !== session && name !== DISPATCH_SESSION);
  return peers.length > 0 && !peers.some((name) => roleOf(name) === 'builder');
};
const ROLE_ENV_WORD = /^(ETHLETE_AGENT_ROLE|CLAUDE_CODE_SILENT_TURN_REMINDER)=/;
const commandWithRole = (command, agentRole) => {
  const wrap = wrapOf(command);
  if (wrap) {
    const head = wrap.head
      .split(/\s+(?=[A-Za-z_][A-Za-z0-9_]*=)/)
      .filter((word) => word && !ROLE_ENV_WORD.test(word.trim()))
      .map((word) => `${word.trim()} `)
      .join('');
    return rewrapped(wrap, head, commandWithRole(wrap.inner, agentRole));
  }
  const tokens = [...command.matchAll(SHELL_WORD)].map(([word]) => word);
  const program = tokens.findIndex((word) => !ENV_WORD.test(word));
  const env = program < 0 ? tokens : tokens.slice(0, program);
  const words = tokens.slice(env.length).map(unquoteWord);
  const kept = words.filter(
    (word, index) =>
      !(word === '--append-system-prompt' && words[index + 1] === BUILDER_PROMPT) &&
      !(word === BUILDER_PROMPT && words[index - 1] === '--append-system-prompt') &&
      !/^(--strict-mcp-config|--mcp-config=.*|--disallowedTools=.*)$/.test(word),
  );
  const rule = agentRole === 'builder' && basename(programOf(kept) ?? '') === 'claude' ? builderFlags() : [];
  return [
    ...env.filter((word) => !ROLE_ENV_WORD.test(word)),
    ...roleEnvWords(agentRole),
    ...[...kept, ...rule].map(quote),
  ].join(' ');
};
const LEADING_ENV_WORDS = /^((?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*)/;
const bypassingShellFunction = (base) => base.replace(LEADING_ENV_WORDS, '$1command ');
const inAgentScope = () => {
  try {
    return /\/agent-[^/]*\.scope$/.test(readFileSync('/proc/self/cgroup', 'utf8').trim());
  } catch {
    return false;
  }
};
const userScopesWork = () =>
  process.platform === 'linux' &&
  spawnSync(
    'busctl',
    [
      '--user',
      'get-property',
      'org.freedesktop.systemd1',
      '/org/freedesktop/systemd1',
      'org.freedesktop.systemd1.Manager',
      'Version',
    ],
    { stdio: 'ignore', timeout: 5000 },
  ).status === 0;
/**
 * Runs the agent in its own systemd user scope that systemd-oomd only picks when no other candidate is left, so a heavy
 * job in the same tmux pane is killed first. `avoid`, not `omit`: a runaway agent must stay killable.
 */
const OWN_SCOPE_PRELOAD = 'tools/scripts/own-scope-preload.mjs';
// A missing preload file must not break every node process of the agent: the data: import swallows the failure.
// The main checkout's copy outlives a worktree.
const ownScopePreloadWords = () => {
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
  if (common.status !== 0) return [];
  const preload = join(dirname(common.stdout.trim()), OWN_SCOPE_PRELOAD);
  if (!existsSync(preload)) return [];
  const source = `await import(${JSON.stringify(pathToFileURL(preload).href)}).catch(() => {});`;
  const option = `--import=data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return [`--setenv=NODE_OPTIONS=${[process.env['NODE_OPTIONS'], option].filter(Boolean).join(' ')}`];
};
const agentScopeWords = (session) =>
  userScopesWork()
    ? [
        'systemd-run',
        '--user',
        '--scope',
        '--quiet',
        '--collect',
        `--unit=agent-${session.replace(/[^A-Za-z0-9_-]/g, '-')}-${Date.now()}`,
        '-p',
        'ManagedOOMPreference=avoid',
        ...ownScopePreloadWords(),
        '--',
      ]
    : [];
const shellWord = (word) => (/^[\w@%+=:,./-]+$/.test(word) ? word : quote(word));
const inAgentScopeCommand = (command, session, unscoped = (plain) => plain) => {
  const words = agentScopeWords(session);
  return words.length ? command.replace(LEADING_ENV_WORDS, `$1${words.map(shellWord).join(' ')} `) : unscoped(command);
};
const EXIT_DIALOG_JOBS = /will stop when you exit/i;
const EXIT_AND_STOP = /exit and stop/i;
const BACKGROUND_FOOTER = /\b\d+ (?:shells?|agents?)\b/i;

/**
 * Reads the last prompt line (`❯` for Claude Code, `›` for Codex) of the pane. Dim text is the empty
 * prompt's placeholder, so it does not count. A menu cursor (`❯ 1. Yes`) also counts, which keeps a
 * wake-up line from answering a permission dialog.
 */
const SGR = `${String.fromCharCode(27)}\\[([0-9;]*)m`;
const BUSY_TEXT = /esc to interrupt|Waiting for/i;
const isTranscript = (line) => /^\s*[●⎿]/.test(line);
/**
 * The line that shows a running turn: the spinner line right above the input box, or a footer line below it.
 * A transcript line (`●`, `⎿`) never counts, since an agent can end its turn with its own "Waiting for ..." text.
 */
const busyLineOf = (lines) => {
  const bottom = lastRuleIndex(lines);
  const top = lines.slice(0, bottom).findLastIndex(isRule);
  if (bottom === -1 || top === -1) return lines.find((line) => BUSY_TEXT.test(line) && !isTranscript(line)) ?? null;
  const spinner = lines.slice(0, top).findLast((line) => line.trim() !== '') ?? '';
  return [spinner, ...lines.slice(bottom + 1)].find((line) => BUSY_TEXT.test(line) && !isTranscript(line)) ?? null;
};
const busyLine = (session) => busyLineOf((tmux('capture-pane', '-p', '-t', `=${session}:`).stdout ?? '').split('\n'));
const restartLog = (message) => {
  mkdirSync(dirname(mailbox), { recursive: true });
  appendFileSync(join(dirname(mailbox), 'restart.log'), `${new Date().toISOString()} ${message}\n`);
};
const restartNotice = (message) => {
  restartLog(message);
  [sender, ...(notify ?? '').split(',')]
    .map((agent) => agent.trim())
    .filter(Boolean)
    .forEach((to) => append({ sender: 'restart', to, message }));
};

const restartLockOf = (session) => join(dirname(mailbox), `restart.lock.${session}`);
const pendingRestartOf = (session) => {
  const lock = readJson(restartLockOf(session));
  return lock && isAlive(lock.pid) && Date.now() - lock.since < RESTART_LOCK_MS ? lock : null;
};
const lockRestart = (session, pid) => {
  mkdirSync(dirname(mailbox), { recursive: true });
  writeFileSync(restartLockOf(session), JSON.stringify({ pid, since: Date.now() }));
};
const unlockRestart = (session) => {
  if (readJson(restartLockOf(session))?.pid === process.pid) rmSync(restartLockOf(session), { force: true });
};
const waitForFirstTurn = (session) => {
  const end = Date.now() + RESTART_RESUME_WAIT_MS;
  while (Date.now() < end && sessionExists(session) && busyLine(session) === null) sleep(RESTART_POLL_MS / 4);
};

/**
 * Waits until the agent ended its turn and nobody types in its prompt, twice in a row; `false` after the time limit.
 * With `allowBusy`, a running turn does not block, since Claude Code queues input typed during a turn.
 * Each change of the reason it waits is logged to `restart.log` next to the mailbox.
 */
const waitForQuiet = (session, limitMs = RESTART_WAIT_MS, allowBusy = false) => {
  const end = Date.now() + limitMs;
  let quiet = 0;
  let reason = '';
  let draftSince = null;
  let told = false;
  while (Date.now() < end) {
    const busy = allowBusy ? null : busyLine(session);
    const draft = busy === null ? draftLine(session) : null;
    const next = busy !== null ? `busy: ${busy.trim()}` : draft !== null ? `draft: ${draft}` : '';
    if (next !== reason) restartLog(`${session} ${next ? `waits, ${next}` : 'is quiet'}`);
    reason = next;
    draftSince = draft === null ? null : (draftSince ?? Date.now());
    if (!told && draftSince !== null && Date.now() - draftSince >= RESTART_DRAFT_NOTICE_MS) {
      told = true;
      restartNotice(`restart of ${session} waits ${Math.round((Date.now() - draftSince) / 1000)}s, draft: ${draft}`);
    }
    quiet = next ? 0 : quiet + 1;
    if (quiet === 2) return true;
    sleep(RESTART_POLL_MS);
  }
  return false;
};

const backgroundWorkOf = (lines) => {
  const footer = lines.slice(lastRuleIndex(lines) + 1).map(plain);
  return footer.find((line) => BACKGROUND_FOOTER.test(line) || isPanelRow(line))?.trim() ?? null;
};

/** The IDE context chip (`[⧉ In file.ts]`, `[⧉ 3 lines selected]`) shares the prompt line and survives `/clear`. */
const IDE_CHIP = /\[⧉ [^\]]*\]/g;
const plain = (line) => line.replace(new RegExp(SGR, 'g'), '');
const isRule = (line) => /^─{10,}$/.test(plain(line).trim());
const isPromptMark = (line) => /^\s*[❯›]/.test(plain(line));
/** A row of the background-agent panel below the footer (`❯ ⏺ main`, `  ● main`, `  ◯ general-purpose …`). */
const isPanelRow = (line) => /^\s*❯?\s*[⏺●◯]/.test(plain(line));
const paneLines = (session) => (tmux('capture-pane', '-p', '-e', '-t', `=${session}:`).stdout ?? '').split('\n');
const lastRuleIndex = (lines) => lines.findLastIndex(isRule);
/**
 * The prompt is the text between the last two rules of the input box. A `❯` line below the last rule that is not a
 * panel row is a menu (`❯ 1. Yes`) and wins, which keeps a wake-up line from answering a permission dialog.
 */
const promptLines = (lines) => {
  const below = lastRuleIndex(lines);
  const menu = lines.slice(below + 1).findLast((line) => isPromptMark(line) && !isPanelRow(line));
  if (menu) return [menu];
  const above = lines.slice(0, below).findLastIndex(isRule);
  if (below !== -1 && above !== -1) return lines.slice(above + 1, below);
  const prompt = lines.findLast((line) => isPromptMark(line) && !isPanelRow(line));
  return prompt ? [prompt] : [];
};
const withoutDim = (line) => {
  let dim = false;
  return line
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
};
const draftLine = (session) => {
  const text = promptLines(paneLines(session))
    .map(withoutDim)
    .join('\n')
    .replace(/^\s*[❯›]/, '')
    .replace(IDE_CHIP, '')
    .trim();
  return text.length > 0 ? text : null;
};
const isInverse = (codes) => {
  for (let index = 0; index < codes.length; index++) {
    if (codes[index] === '38' || codes[index] === '48') index += codes[index + 1] === '2' ? 4 : 2;
    else if (codes[index] === '7') return true;
  }
  return false;
};
/** A focused footer pill or panel row is drawn inverse (`ESC[7m`); older builds mark a focused row with `❯`. */
const panelFocused = (lines) =>
  lines
    .slice(lastRuleIndex(lines) + 1)
    .some(
      (line) =>
        [...line.matchAll(new RegExp(SGR, 'g'))].some((match) => isInverse(match[1].split(';'))) ||
        /^\s*❯\s*[⏺●◯]/.test(plain(line)),
    );
const PANEL_UP_LIMIT = 10;
/**
 * Keys typed while the focus sits in the background-agent panel go into the panel. Up moves the focus back to the
 * prompt, and an Up too many recalls history, so C-u clears the line after. `false` if the focus did not leave.
 */
const leavePanel = (session) => {
  if (!panelFocused(paneLines(session))) return true;
  for (let press = 0; press < PANEL_UP_LIMIT; press++) {
    tmux('send-keys', '-t', `=${session}:`, 'Up');
    sleep(ENTER_DELAY_MS);
    if (!panelFocused(paneLines(session))) {
      tmux('send-keys', '-t', `=${session}:`, 'C-u');
      sleep(ENTER_DELAY_MS);
      return true;
    }
  }
  return false;
};
const hasDraft = (session) => draftLine(session) !== null;
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

const ensureDispatch = (quiet = true) =>
  startSession(
    DISPATCH_SESSION,
    `${process.env.AGENT_MAILBOX ? `AGENT_MAILBOX=${quote(process.env.AGENT_MAILBOX)} ` : ''}node ${quote(script)} dispatch`,
    quiet,
  );

const IGNORED = ['mailbox.jsonl', 'mailbox.cursor.*', 'restart.log', 'restart.prompt.*', 'restart.lock.*'];

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
  } else if (recipient && !localSessionFor(recipient)) {
    const checkouts = foreignCheckoutsOf(recipient);
    process.stderr.write(
      `Refused: ${recipient} is not a session of ${repoSlug}${checkouts.length ? `; it belongs to ${checkouts.join(', ')}` : ''}. Nothing was sent. Pass the name of a session ${sessionFor('<agent>')} of this checkout.\n`,
    );
    process.exitCode = 1;
  } else {
    append({ sender, message, ...(recipient ? { to: recipient } : {}) });
    process.stdout.write(`Sent as ${sender}.\n`);
  }
} else if (command === 'up') {
  ensureDispatch(false);
  [sender, ...words].filter(Boolean).forEach((spec) => {
    const [name, ...rest] = spec.split('=');
    startSession(sessionFor(name), rest.join('=') || undefined);
  });
} else if (command === 'run' && sender && words.length && role !== undefined && role !== 'builder') {
  process.stderr.write(`Unknown role ${role}. Only builder exists.\n`);
  process.exitCode = 1;
} else if (command === 'run' && sender && words.length && !hasAgentBinary(words)) {
  process.stderr.write(`Refused: no agent was started, ${words.join(' ')} has no program to run.\n`);
  process.exitCode = 1;
} else if (command === 'run' && sender && words.length && configMismatch(words)) {
  process.stderr.write(
    `Refused: no agent was started, the command sets CLAUDE_CONFIG_DIR=${configDirOf(words)} but the caller runs under ${callerConfigDir()}. One checkout keeps one config.\n`,
  );
  process.exitCode = 1;
} else if (command === 'run' && sender && words.length && dryRun) {
  process.stdout.write(
    `${withTempDir([...callerConfigWords(words), ...roleEnvWords(role), ...withRole(words).map(quote)].join(' '))}\n`,
  );
} else if (
  command === 'run' &&
  sender &&
  words.length &&
  (!runsInSession(words.slice(1)) || (process.env.TMUX && [sessionFor(sender), sender].includes(ownSession())))
) {
  if (runsInSession(words.slice(1))) {
    const own = `=${ownSession()}:`;
    tmux(
      'set-option',
      '-t',
      own,
      COMMAND_OPTION,
      withTempDir(
        [...callerConfigWords(words), ...roleEnvWords(role), ...withRole(withoutPrompt(words)).map(quote)].join(' '),
      ),
    );
    if (role) tmux('set-option', '-t', own, ROLE_OPTION, role);
  }
  const [program, ...programArgs] = [
    ...(inAgentScope() ? [] : agentScopeWords(ownSession() ?? sender)),
    ...withRole(words),
  ];
  process.exitCode =
    spawnSync(program, programArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLAUDE_CODE_TMPDIR: ensuredClaudeTmpDir(),
        ...roleEnvOf(role),
      },
    }).status ?? 1;
} else if (command === 'run' && sender && words.length) {
  ensureDispatch();
  const session = freeSessionFor(sender);
  const roleEnv = [...callerConfigWords(words), ...roleEnvWords(role)].map((word) => `${word} `).join('');
  const shellCommand = withTempDir(`${roleEnv}${withRole(words).map(quote).join(' ')}`);
  const baseCommand = withTempDir(`${roleEnv}${withRole(withoutPrompt(words)).map(quote).join(' ')}`);
  if (process.env.TMUX) {
    if (sessionExists(session)) {
      process.stderr.write(
        `Refused: ${session} already exists, no second agent was started. Switch to it with: tmux switch-client -t ${session}\n`,
      );
      process.exitCode = 1;
    } else createRunSession(session, shellCommand, baseCommand);
    const callerSession = hasTerminal
      ? tmux('display-message', '-p', '-t', process.env.TMUX_PANE ?? '', '#{session_id}').stdout.trim()
      : '';
    const [callerClient] = callerSession
      ? tmux('list-clients', '-t', callerSession, '-F', '#{client_tty}').stdout.split('\n').filter(Boolean)
      : [];
    if (!process.exitCode && !callerClient)
      process.stdout.write(`Started ${session}. Attach with: tmux attach -t ${session}\n`);
    process.exitCode ||= callerClient
      ? (spawnSync('tmux', ['switch-client', '-c', callerClient, '-t', `=${session}`], { stdio: 'inherit' }).status ??
        1)
      : 0;
  } else if (!hasTerminal) {
    if (!sessionExists(session)) createRunSession(session, shellCommand, baseCommand);
    if (!process.exitCode) process.stdout.write(`Started ${session}. Attach with: tmux attach -t ${session}\n`);
  } else {
    if (!sessionExists(session)) createRunSession(session, shellCommand, baseCommand);
    process.exitCode ||= !sessionExists(session)
      ? 1
      : (spawnSync('tmux', ['attach-session', '-t', `=${session}`], { stdio: 'inherit' }).status ?? 1);
  }
} else if (command === 'shell-init' || command === 'shell-install') {
  const agents = [sender, ...words].filter(Boolean);
  const locate = `_ethlete_agent_sessions_script() {
  local root dir
  root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  for dir in .agents/skills .claude/skills; do
    if [ -f "$root/$dir/ethlete-agent-sessions/agent-sessions.mjs" ]; then
      printf '%s\\n' "$root/$dir/ethlete-agent-sessions/agent-sessions.mjs"
      return 0
    fi
  done
  return 1
}
`;
  const functions = (agents.length ? agents : ['claude', 'codex'])
    .map(
      (agent) => `${agent}() {
  local script
  script=$(_ethlete_agent_sessions_script)
  if [ -n "$script" ] && command -v tmux >/dev/null; then
    node "$script" run ${agent} ${agent} "$@"
  else
    command ${agent} "$@"
  fi
}
`,
    )
    .reduce((text, fn) => text + fn, locate);
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
  const own = process.env.TMUX_PANE
    ? tmux('display-message', '-p', '-t', process.env.TMUX_PANE, '#{session_name}').stdout.trim()
    : null;
  const session = localSessionFor(sender) ?? (own === sender ? own : undefined);
  const dropped = session && !now ? droppedQuestions(session, own, words.join(' ')) : [];
  const pending = session ? pendingRestartOf(session) : null;
  if (session) ensureDispatch();
  if (!session) {
    process.stderr.write(`No tmux session for ${sender}.\n`);
    process.exitCode = 1;
  } else if (pending && pending.pid !== process.pid) {
    process.stderr.write(
      `Refused: a restart of ${session} is already pending (pid ${pending.pid} since ${new Date(pending.since).toISOString()}). Let it finish, or end that process first.\n`,
    );
    restartLog(`${session} refused a second restart, pid ${pending.pid} still pending`);
    process.exitCode = 1;
  } else if (own && own !== session && !arePaired(own, session)) {
    process.stderr.write(
      `Refused: ${session} is not your session. You run in ${own}, so pass ${own.replace(`@${repoSlug}`, '')}.\n`,
    );
    process.exitCode = 1;
  } else if (role !== undefined && role !== 'builder' && role !== 'none') {
    process.stderr.write(`Unknown role ${role}. Pass --role builder or --role none.\n`);
    process.exitCode = 1;
  } else if (newProcess && hasUnknownRole(session, words.join(' '))) {
    process.stderr.write(
      `Refused: ${session} has no role and another agent session runs in this repo, so the new process could lose the builder rule. Resume a builder-* or doc-agent-* handoff, or pass --role builder or --role none.\n`,
    );
    process.exitCode = 1;
  } else if (
    (newProcess || (now && backgroundWorkOf(paneLines(session)) !== null)) &&
    healedCommand(commandWithoutPrompt(agentCommandOf(session)), sender) === null
  ) {
    process.stderr.write(
      `Refused: the stored command of ${session} has no claude or codex program (${agentCommandOf(session)}), restarting would end the session. Nothing was stopped.\n`,
    );
    restartLog(`${session} refused, stored command has no agent program: ${agentCommandOf(session)}`);
    process.exitCode = 1;
  } else if (dropped.length) {
    process.stderr.write(
      `Refused: ${session} asked the human a ❓ question that no later human message answers, and the handoff does not name it. Put each question verbatim under "Open for the human" in the handoff the prompt resumes (/handoff resume <name>), then restart again:\n${dropped.map((question) => `❓ ${question}`).join('\n')}\n`,
    );
    process.exitCode = 1;
  } else if (now) {
    lockRestart(session, process.pid);
    process.on('exit', () => unlockRestart(session));
    const type = (...keys) => tmux('send-keys', '-t', `=${session}:`, ...keys);
    sleep(Number(afterSeconds ?? RESTART_AFTER_SECONDS) * 1000);
    if (!waitForQuiet(session)) {
      restartNotice(`restart of ${session} gave up after ${RESTART_WAIT_MS / 1000}s, reason in restart.log`);
      process.exitCode = 1;
    } else if (!leavePanel(session)) {
      restartNotice(
        `restart of ${session} gave up, the focus did not leave the agent panel after ${PANEL_UP_LIMIT} Up`,
      );
      process.exitCode = 1;
    } else if (newProcess || backgroundWorkOf(paneLines(session)) !== null) {
      const background = newProcess ? null : backgroundWorkOf(paneLines(session));
      if (background !== null)
        restartLog(`${session} shows background work (${background}), restart goes through --process`);
      const pane = `=${session}:`;
      const restartRole = restartRoleOf(session, words.join(' '));
      const recorded = commandWithoutPrompt(agentCommandOf(session));
      const stored = healedCommand(recorded, sender);
      if (stored === null) {
        restartNotice(`restart of ${session} refused, its stored command has no agent program: ${recorded}`);
        process.exit(1);
      }
      if (configMismatch(stored.split(' ').map((word) => word.replaceAll("'", '')))) {
        restartNotice(
          `restart of ${session} refused, its command sets another CLAUDE_CONFIG_DIR than the caller (${callerConfigDir()})`,
        );
        process.exit(1);
      }
      if (stored !== recorded) {
        tmux('set-option', '-t', pane, COMMAND_OPTION, stored);
        restartLog(`${session} stored command could not restart, healed to: ${stored}`);
      }
      const staleRole =
        !restartRole && (roleOf(session) !== null || role === 'none' || handoffRoleOf(words.join(' ')) === 'doc-agent');
      const base = withTempDir(restartRole || staleRole ? commandWithRole(stored, restartRole) : stored);
      if (restartRole) tmux('set-option', '-t', pane, ROLE_OPTION, restartRole);
      else if (staleRole) tmux('set-option', '-u', '-t', pane, ROLE_OPTION);
      tmux('set-option', '-p', '-t', pane, 'remain-on-exit', 'on');
      type('-l', sender.startsWith('codex') ? '/quit' : '/exit');
      sleep(ENTER_DELAY_MS);
      type('Enter');
      const end = Date.now() + RESTART_EXIT_WAIT_MS;
      const dead = () => tmux('display-message', '-p', '-t', pane, '#{pane_dead}').stdout.trim() === '1';
      const answerExitDialog = () => {
        const lines = (tmux('capture-pane', '-p', '-t', pane).stdout ?? '').split('\n');
        const start = lines.findIndex((line) => EXIT_DIALOG_JOBS.test(line));
        const stop = lines.findIndex((line, index) => index > start && EXIT_AND_STOP.test(line));
        if (start < 0 || stop < 0) return false;
        const selected = lines.findIndex((line, index) => index > start && line.trim().startsWith('❯'));
        const jobs = lines
          .slice(start + 1, stop)
          .map((line) => line.trim())
          .filter(Boolean);
        restartNotice(
          `restart of ${session} stopped its background work, start it again: ${jobs.join('; ') || '(none listed)'}`,
        );
        const between = (from, to) => lines.slice(from, to).filter((line) => line.trim()).length;
        const [key, steps] = selected > stop ? ['Up', between(stop, selected)] : ['Down', between(selected, stop)];
        for (let step = 0; selected >= 0 && step < steps; step++) type(key);
        type('Enter');
        return true;
      };
      let answered = false;
      while (!dead() && Date.now() < end) {
        if (!answered) answered = answerExitDialog();
        sleep(RESTART_POLL_MS / 4);
      }
      if (!dead()) restartLog(`${session} did not exit ${RESTART_EXIT_WAIT_MS / 1000}s after the exit command, killed`);
      const shell = process.env.SHELL || 'sh';
      const baseWrap = wrapOf(base);
      const launch = baseWrap
        ? inAgentScopeCommand(
            rewrapped(
              baseWrap,
              baseWrap.head,
              `${bypassingShellFunction(baseWrap.inner)} ${quote(restartPrompt(words))}`,
            ),
            session,
          )
        : `${inAgentScopeCommand(base, session, bypassingShellFunction)} ${quote(restartPrompt(words))}`;
      tmux('respawn-pane', '-k', '-t', pane, '-c', root, shell, '-lic', launch);
      tmux('set-option', '-p', '-t', pane, 'remain-on-exit', 'off');
      tmux('set-option', '-t', pane, COMMAND_OPTION, base);
      restartLog(`${session} started a new process: ${base}`);
      waitForFirstTurn(session);
    } else {
      type('-l', sender.startsWith('codex') ? '/new' : '/clear');
      sleep(ENTER_DELAY_MS);
      type('Enter');
      sleep(RESTART_CLEAR_MS);
      if (waitForQuiet(session, RESTART_CLEAR_WAIT_MS, true) && leavePanel(session)) {
        type('-l', restartPrompt(words));
        sleep(ENTER_DELAY_MS);
        type('Enter');
        waitForFirstTurn(session);
      } else {
        const saved = join(dirname(mailbox), `restart.prompt.${session}.txt`);
        writeFileSync(saved, `${restartPrompt(words)}\n`);
        restartNotice(
          `restart of ${session} gave up: prompt not empty ${RESTART_CLEAR_WAIT_MS / 1000}s after the clear, prompt not typed, saved to ${saved}`,
        );
        tmux(
          'display-message',
          '-t',
          `=${session}:`,
          `restart: prompt not empty after the clear, prompt not typed. Saved to ${saved}`,
        );
        process.exitCode = 1;
      }
    }
  } else {
    if (own && own !== session) restartLog(`peer restart: ${own} restarted ${session}`);
    const delay = Number(afterSeconds ?? RESTART_AFTER_SECONDS);
    const forward = notify ? ['--notify', notify] : [];
    const mode = [...(newProcess ? ['--process'] : []), ...(role ? ['--role', role] : [])];
    const child = spawn(
      process.execPath,
      [script, 'restart', sender, '--now', '--after', String(delay), ...forward, ...mode, ...words],
      {
        detached: true,
        stdio: 'ignore',
      },
    );
    lockRestart(session, child.pid);
    child.unref();
    process.stdout.write(
      `${newProcess ? 'Starting a new process in' : 'Restarting'} ${session} once its turn ended and its prompt is empty, ${delay} seconds at the earliest. End your turn now.\n`,
    );
  }
} else if (command === 'down') {
  [DISPATCH_SESSION, ...[sender, ...words].filter(Boolean).map(sessionFor)].forEach((name) => {
    const result = tmux('kill-session', '-t', `=${name}`);
    process.stdout.write(result.status === 0 ? `Stopped ${name}.\n` : `No session ${name}.\n`);
  });
} else if (command === 'dispatch') {
  prepare();
  appendFileSync(mailbox, '');
  const started = entries().length;
  let seen = started;
  const woken = {};
  const due = {};
  const waiting = new Set();
  const addressedTo = (agent) => {
    const history = entries();
    const cursor = inboxCursor(agent);
    const read = existsSync(cursor) ? Number(readFileSync(cursor, 'utf8')) : 0;
    return {
      count: history.length,
      unread: history
        .slice(Math.max(read, woken[agent] ?? started))
        .filter((entry) => entry.to === agent && entry.sender !== agent),
    };
  };
  const wake = (agent) => {
    if (!addressedTo(agent).unread.length) return;
    const session = localSessionFor(agent);
    if (!session) return process.stderr.write(`No tmux session ${sessionFor(agent)} in this checkout.\n`);
    if (pendingRestartOf(session)) {
      if (!waiting.has(agent)) process.stdout.write(`Waiting for the restart of ${session}.\n`);
      waiting.add(agent);
      due[agent] = Date.now() + DRAFT_RETRY_MS;
      return;
    }
    if (hasDraft(session)) {
      if (!waiting.has(agent)) process.stdout.write(`Waiting for the typed text in ${session}.\n`);
      waiting.add(agent);
      due[agent] = Date.now() + DRAFT_RETRY_MS;
      return;
    }
    waiting.delete(agent);
    if (!leavePanel(session)) return process.stderr.write(`The focus of ${session} stays in the agent panel.\n`);
    const { count, unread } = addressedTo(agent);
    unread.forEach((entry) => {
      spawnSync('tmux', [
        'send-keys',
        '-t',
        `=${session}:`,
        '-l',
        `Mailbox message from ${entry.sender}: ${normalize(String(entry.message ?? ''))}`,
      ]);
      sleep(ENTER_DELAY_MS);
      spawnSync('tmux', ['send-keys', '-t', `=${session}:`, 'Enter']);
    });
    woken[agent] = count;
    if (existsSync(inboxCursor(agent))) writeFileSync(inboxCursor(agent), String(count));
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
