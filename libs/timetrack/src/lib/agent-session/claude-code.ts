import { AgentPromptEvent, AgentSessionEvent, AgentUsageEvent, PromptAskedBy, TokenUsage } from '../model/event';
import { pathIsUnder } from '../model/project-link';
import { asJsonObject, countAt, objectAt, stringAt } from './record';
import { AgentSessionLogParseOptions, AgentSessionLogParser, DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS } from './source';

/** The name this parser's events carry, and the first half of the key the store deduplicates them on. */
export const CLAUDE_CODE_PROVIDER = 'claude-code';

/** The model Claude Code names on a record it wrote itself. Every count on it is zero. */
const SYNTHETIC_MODEL = '<synthetic>';

type ActivityRecord = { at: Date; sessionId: string; cwd: string; gitBranch?: string };

type WorkedRecord = ActivityRecord & { workedIn: string };

type TitleCandidates = { custom?: string; generated?: string; firstPrompt?: string };

/**
 * The branch the record names, or `undefined` for a detached checkout.
 *
 * `git rev-parse --abbrev-ref HEAD` answers `HEAD` when no branch is checked out, and the agent writes
 * that answer through. Git refuses `HEAD` as a branch name, so it never names one — and keeping it
 * would label a block with a word that says nothing and that the branch grammar can never resolve.
 */
const branchOf = (record: Record<string, unknown>) => {
  const branch = stringAt(record, 'gitBranch');

  return branch === 'HEAD' ? undefined : branch;
};

/**
 * Anything carrying a timestamp, a working directory and a session id counts as a sample of the
 * session running, whatever its record type — so a record type the agent adds later still lands.
 */
const activityOf = (record: Record<string, unknown>): ActivityRecord | null => {
  const timestamp = stringAt(record, 'timestamp');
  const sessionId = stringAt(record, 'sessionId');
  const cwd = stringAt(record, 'cwd');

  if (!timestamp || !sessionId || !cwd) return null;

  const at = new Date(timestamp);

  return Number.isNaN(at.getTime()) ? null : { at, sessionId, cwd, gitBranch: branchOf(record) };
};

type ShellStep = { words: string[]; redirects: string[] };

const HEREDOC = /^<<-?\s*(?:'([^']*)'|"([^"]*)"|([^\s;&|<>]+))/;

const CLOSERS: Record<string, string> = { "'": "'", '"': '"', '`': '`', '(': ')', '{': '}' };

const closingOf = (command: string, openAt: number) => {
  const open = command[openAt] ?? '';
  const close = CLOSERS[open];
  let depth = 1;

  for (let index = openAt + 1; index < command.length; index++) {
    const char = command[index];

    if (char === '\\' && open !== "'") index++;
    else if (char === close && --depth === 0) return index;
    else if (char === open) depth++;
    else if (char === "'" && open === '(') index = closingOf(command, index);
  }

  return command.length;
};

const shellStepsOf = (command: string): ShellStep[] => {
  const steps: ShellStep[] = [];
  const heredocs: string[] = [];
  let step: ShellStep = { words: [], redirects: [] };
  let word = '';
  let inWord = false;
  let target: 'word' | 'redirect' | 'input' = 'word';

  const endWord = () => {
    if (!inWord) return;
    if (target === 'redirect') step.redirects.push(word);
    else if (target === 'word') step.words.push(word);
    word = '';
    inWord = false;
    target = 'word';
  };
  const endStep = () => {
    endWord();
    if (step.words.length || step.redirects.length) steps.push(step);
    step = { words: [], redirects: [] };
  };
  const append = (text: string) => {
    word += text;
    inWord = true;
  };

  for (let index = 0; index < command.length; index++) {
    const char = command[index] ?? '';
    const next = command[index + 1];

    if (char === '\\') {
      if (next !== '\n') append(next ?? '');
      index++;
    } else if (char === "'") {
      const end = closingOf(command, index);

      append(command.slice(index + 1, end));
      index = end;
    } else if (char === '"') {
      const end = closingOf(command, index);

      append(command.slice(index + 1, end).replace(/\\(.)/g, '$1'));
      index = end;
    } else if (char === '$' && next === '(') {
      append('$()');
      index = closingOf(command, index + 1);
    } else if (char === '$' && next === '{') {
      append('${}');
      index = closingOf(command, index + 1);
    } else if (char === '`') {
      append('$()');
      index = closingOf(command, index);
    } else if (char === '<' && next === '<' && command[index + 2] !== '<') {
      const match = HEREDOC.exec(command.slice(index));

      if (match) heredocs.push(match[1] ?? match[2] ?? match[3] ?? '');
      endWord();
      index += (match?.[0].length ?? 2) - 1;
    } else if (char === '<') {
      endWord();
      target = 'input';
      if (next === '<') index++;
    } else if (char === '>' || (char === '&' && next === '>')) {
      if (inWord && /^\d+$/.test(word)) {
        word = '';
        inWord = false;
      } else endWord();

      index += char === '&' ? 1 : 0;
      if (command[index + 1] === '>' || command[index + 1] === '|') index++;

      if (command[index + 1] === '&') {
        index++;
        while (/[\d-]/.test(command[index + 1] ?? '')) index++;
      } else target = 'redirect';
    } else if (char === '\n') {
      endStep();

      for (const delimiter of heredocs.splice(0)) {
        const end = command.slice(index + 1).search(new RegExp(`^\\s*${delimiter.replace(/\W/g, '\\$&')}\\s*$`, 'm'));

        if (end < 0) return steps;

        index = command.indexOf('\n', index + 1 + end);
        if (index < 0) return steps;
      }
    } else if (char === ';' || char === '|' || char === '&' || char === '(' || char === ')') {
      endStep();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      append(char);
    }
  }

  endStep();

  return steps;
};

const PREFIX_WORDS = new Set([
  '!',
  '{',
  '}',
  'builtin',
  'command',
  'do',
  'elif',
  'else',
  'env',
  'exec',
  'if',
  'nice',
  'nohup',
  'sudo',
  'then',
  'time',
  'until',
  'while',
]);

const XARGS_OPTIONS_WITH_VALUE = new Set(['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s']);

const programOf = (words: string[]) => {
  let rest = words;

  for (;;) {
    const [first = '', ...tail] = rest;

    if (PREFIX_WORDS.has(first) || /^\w+=/.test(first)) rest = tail;
    else if (first === 'timeout') rest = tail.slice(tail.findIndex((arg) => !arg.startsWith('-')) + 1);
    else if (first === 'xargs') {
      const at = tail.findIndex(
        (arg, index) => !arg.startsWith('-') && !XARGS_OPTIONS_WITH_VALUE.has(tail[index - 1] ?? ''),
      );

      rest = at < 0 ? [] : tail.slice(at);
    } else return rest;
  }
};

const isScratchPath = (path: string) =>
  path.startsWith('$') || /^(?:\/dev|\/tmp|\/var\/tmp|\/proc)(?:\/|$)/.test(path) || path === '-';

const operandsOf = (args: string[]) => args.filter((arg) => !arg.startsWith('-'));

const touchesRealFile = (paths: string[]) => paths.some((path) => !isScratchPath(path));

const WRITING_GIT = new Set([
  'add',
  'am',
  'apply',
  'checkout',
  'cherry-pick',
  'clean',
  'commit',
  'merge',
  'mv',
  'pull',
  'rebase',
  'reset',
  'restore',
  'revert',
  'rm',
  'stash',
  'switch',
]);

const GIT_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree']);

const READING_STASH = new Set(['list', 'show']);

const isWritingGit = (args: string[]) => {
  const operands = args.filter(
    (arg, index) => !arg.startsWith('-') && !GIT_OPTIONS_WITH_VALUE.has(args[index - 1] ?? ''),
  );
  const [subcommand = '', action] = operands;

  if (subcommand === 'stash') return !READING_STASH.has(action ?? '');

  return WRITING_GIT.has(subcommand);
};

const FILE_WRITERS = new Set(['cp', 'ln', 'mkdir', 'mv', 'rm', 'rmdir', 'touch']);

const TREE_WRITERS = new Set(['bun', 'bunx', 'cargo', 'make', 'npm', 'npx', 'nx', 'pnpm', 'yarn']);

const READING_PACKAGE_COMMANDS = new Set([
  'bin',
  'config',
  'explain',
  'info',
  'list',
  'ls',
  'outdated',
  'prefix',
  'root',
  'search',
  'view',
  'why',
]);

const isWritingStep = ({ words, redirects }: ShellStep): boolean => {
  if (touchesRealFile(redirects)) return true;

  const [program = '', ...args] = programOf(words);
  const operands = operandsOf(args);

  switch (program) {
    case 'sed':
      return args.some((arg) => /^-[a-zA-Z]*i/.test(arg) || arg.startsWith('--in-place'));
    case 'perl':
      return args.some((arg) => /^-[a-zA-Z]*i/.test(arg));
    case 'tee':
      return touchesRealFile(operands);
    case 'git':
      return isWritingGit(args);
    case 'find': {
      const exec = args.findIndex((arg) => arg === '-exec' || arg === '-execdir');

      return args.includes('-delete') || (exec >= 0 && isWritingStep({ words: args.slice(exec + 1), redirects: [] }));
    }
    case 'bash':
    case 'sh':
    case 'zsh':
      return args.includes('-c') && isWritingCommand(args[args.indexOf('-c') + 1] ?? '');
    case 'cp':
    case 'mv':
    case 'ln':
      return touchesRealFile(operands.slice(-1));
  }

  if (FILE_WRITERS.has(program)) return touchesRealFile(operands);
  if (TREE_WRITERS.has(program)) return !READING_PACKAGE_COMMANDS.has(operands[0] ?? '') && !args.includes('--version');

  return false;
};

const isWritingCommand = (command: string) => shellStepsOf(command).some(isWritingStep);

const WRITE_TOOLS = new Set(['Edit', 'MultiEdit', 'NotebookEdit', 'Write']);

/**
 * Where one tool call wrote: the absolute path it named, `null` for the working directory, and
 * `undefined` where the call says nothing about a place. Only a clear write answers: a command that
 * merely might write, like a script or a program this list does not know, counts as a read.
 *
 * Claude Code puts the shell back into the session's directory after a command that left it, so a
 * command reaches another checkout only by changing into it first, and every record still names the
 * directory the session started in.
 */
const workedInOfTool = (block: Record<string, unknown>): string | null | undefined => {
  const input = stringAt(block, 'type') === 'tool_use' ? objectAt(block, 'input') : null;
  const name = stringAt(block, 'name');

  if (!input) return undefined;

  if (name === 'Bash') {
    const command = stringAt(input, 'command') ?? '';

    if (!isWritingCommand(command)) return undefined;

    const [first] = shellStepsOf(command);
    const path = first?.words[0] === 'cd' ? first.words[1] : undefined;

    return path?.startsWith('/') ? path : null;
  }

  if (!WRITE_TOOLS.has(name ?? '')) return undefined;

  const path = stringAt(input, 'file_path') ?? stringAt(input, 'notebook_path');

  if (path === undefined) return undefined;

  return path.startsWith('/') ? path : null;
};

const workedInOfRecord = (record: Record<string, unknown>): string | null | undefined => {
  const content = objectAt(record, 'message')?.['content'];
  let found: string | null | undefined;

  if (!Array.isArray(content)) return undefined;

  for (const block of content) {
    const tool = objectAt({ block }, 'block');
    const said = tool ? workedInOfTool(tool) : undefined;

    if (said !== undefined) found = said;
  }

  return found;
};

/**
 * The turn's own counts, from the top level of `usage` only. `usage.iterations` restates them per API
 * call, so reading it as well would count a turn twice.
 */
const tokenUsageOf = (usage: Record<string, unknown>): TokenUsage => ({
  input: countAt(usage, 'input_tokens'),
  output: countAt(usage, 'output_tokens'),
  cacheWrite: countAt(usage, 'cache_creation_input_tokens'),
  cacheRead: countAt(usage, 'cache_read_input_tokens'),
  thinking: countAt(objectAt(usage, 'output_tokens_details'), 'thinking_tokens'),
});

/**
 * The spend of one turn, or `null` where the record reports none.
 *
 * A subagent's records name the parent session in `sessionId` and the subagent in `agentId`, so a
 * subagent's spend already lands in the stream that asked for it.
 */
const usageOf = (record: Record<string, unknown>, workedIn: string | undefined): AgentUsageEvent | null => {
  const activity = activityOf(record);
  const message = objectAt(record, 'message');
  const usage = message ? objectAt(message, 'usage') : null;
  const turnId = message ? stringAt(message, 'id') : undefined;
  const model = message ? stringAt(message, 'model') : undefined;

  if (!activity || !usage || !turnId || !model || model === SYNTHETIC_MODEL) return null;

  return {
    at: activity.at,
    source: 'agent-usage',
    kind: 'agent-usage',
    provider: CLAUDE_CODE_PROVIDER,
    sessionId: activity.sessionId,
    turnId,
    cwd: activity.cwd,
    gitBranch: activity.gitBranch,
    workedIn: workedIn ?? activity.cwd,
    model,
    usage: tokenUsageOf(usage),
    agentId: stringAt(record, 'agentId'),
  };
};

/** The `promptSource` values a person is behind. Anything else the agent wrote for itself. */
const HUMAN_PROMPT_SOURCES = ['typed', 'queued', 'suggestion_accepted'];

/**
 * Who asked for this prompt, or `undefined` where the record does not say.
 *
 * `origin.kind` is read first and answers alone: the agent states it, and `human` is the only value
 * that means a person. `promptSource` is the older field and is read only as a fallback, where
 * `system` is the agent writing to itself — a scheduled run, a task notification, a message from
 * another session. A record carrying neither is from a version that recorded neither, so it stays
 * unanswered rather than guessed at.
 */
const askedByOf = (record: Record<string, unknown>): PromptAskedBy | undefined => {
  const origin = objectAt(record, 'origin');
  const kind = origin ? stringAt(origin, 'kind') : undefined;

  if (kind) return kind === 'human' ? 'human' : 'machine';

  const source = stringAt(record, 'promptSource');

  if (!source) return undefined;

  return HUMAN_PROMPT_SOURCES.includes(source) ? 'human' : 'machine';
};

/**
 * The prompt an agent was given, or `null` for every other record.
 *
 * A user record whose content is a plain string is what was sent; a tool result arrives as the same
 * type with `toolUseResult` beside it, and a content array is never typed by hand. A sidechain record
 * is a subagent's instructions written by the model, so it is nobody at a keyboard.
 *
 * A prompt nobody asked for is still emitted, with `askedBy: 'machine'`. It is what the session ran
 * on, so the day needs it to say what happened; it simply may not say that a person was there.
 */
const promptOf = (record: Record<string, unknown>, workedIn: string | undefined): AgentPromptEvent | null => {
  if (stringAt(record, 'type') !== 'user') return null;
  if (record['toolUseResult'] !== undefined && record['toolUseResult'] !== null) return null;
  if (record['isMeta'] === true || record['isSidechain'] === true) return null;

  const message = objectAt(record, 'message');
  const activity = activityOf(record);
  const promptId = stringAt(record, 'uuid');

  if (!message || !activity || !promptId || typeof message['content'] !== 'string') return null;

  const askedBy = askedByOf(record);

  return {
    at: activity.at,
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: CLAUDE_CODE_PROVIDER,
    sessionId: activity.sessionId,
    promptId,
    cwd: activity.cwd,
    gitBranch: activity.gitBranch,
    workedIn: workedIn ?? activity.cwd,
    ...(askedBy ? { askedBy } : {}),
  };
};

const readTitle = (record: Record<string, unknown>, into: TitleCandidates) => {
  const type = stringAt(record, 'type');

  if (type === 'custom-title') {
    into.custom = stringAt(record, 'customTitle') ?? into.custom;

    return;
  }

  if (type === 'ai-title') {
    into.generated = stringAt(record, 'aiTitle') ?? into.generated;

    return;
  }

  // A fresh `last-prompt` record is appended for every prompt, so the first one in file order is the
  // prompt that opened the session. The last one describes only what the session ended on.
  if (type === 'last-prompt' && into.firstPrompt === undefined) {
    into.firstPrompt = stringAt(record, 'lastPrompt');
  }
};

const fromPrompt = (prompt: string | undefined, fallback: AgentSessionLogParseOptions['promptFallback']) => {
  if (!prompt || !fallback || fallback.maxLength < 1) return undefined;

  const oneLine = prompt.replace(/\s+/g, ' ').trim();

  if (!oneLine) return undefined;

  return oneLine.length > fallback.maxLength ? `${oneLine.slice(0, fallback.maxLength).trimEnd()}…` : oneLine;
};

/**
 * The path one level below where `workedIn` parts from `cwd`, or nothing while it stays inside. Coarse,
 * so a session editing many files of another checkout emits on entering it rather than per file.
 */
const leftCwdFor = (record: WorkedRecord) => {
  if (pathIsUnder(record.cwd, record.workedIn)) return '';

  const from = record.cwd.split('/');
  const to = record.workedIn.split('/');
  let shared = 0;

  while (shared < from.length && from[shared] === to[shared]) shared++;

  return to.slice(0, shared + 1).join('/');
};

const contextOf = (record: WorkedRecord) => `${record.cwd}\u0000${record.gitBranch ?? ''}\u0000${leftCwdFor(record)}`;

/**
 * Reads a Claude Code session log — the JSONL file under `~/.claude/projects/<cwd-slug>/` — into
 * activity samples. The working directory and the branch are taken per record rather than per session,
 * so switching branch mid-session splits the block the way a checkout would.
 *
 * Records are thinned to one sample per `sampleIntervalMs`, except that a change of directory or branch
 * always emits, and so does each session's final record, so a block ends where the session did.
 *
 * Every turn that reports `message.usage` also becomes an `AgentUsageEvent`, and every prompt the user
 * typed becomes an `AgentPromptEvent`, both whatever the sample interval: neither is a sample of time.
 *
 * Only metadata is read. Message bodies never become events, and the session's first prompt is used as
 * a title only when `promptFallback` asks for it.
 */
export const parseClaudeCodeSessionLog: AgentSessionLogParser = (options) => {
  const interval = options.sampleIntervalMs ?? DEFAULT_AGENT_SESSION_SAMPLE_INTERVAL_MS;
  const after = options.resume?.after;
  const titles: TitleCandidates = {};
  const records: WorkedRecord[] = [];
  // One assistant message is written as several records — one per content block — and each of them
  // restates the same `message.usage`. Measured over this machine's logs: 46 % of usage records repeat
  // an id, and a repeated id never carried different counts. So the first one wins.
  const usageByTurnId = new Map<string, AgentUsageEvent>();
  const promptById = new Map<string, AgentPromptEvent>();
  let unparsedLines = 0;
  let workedIn = options.resume?.session?.workedIn;

  for (const line of options.lines) {
    if (!line.trim()) continue;

    const parsed = asJsonObject(line);

    if (!parsed) {
      unparsedLines++;
      continue;
    }

    readTitle(parsed, titles);

    const said = workedInOfRecord(parsed);

    if (said !== undefined) workedIn = said ?? undefined;

    const spend = usageOf(parsed, workedIn);

    // No `after` guard: `after` follows the thinned samples, and a turn behind it is spend, not a
    // repeat. The store's dedupe key — the provider and the turn id — is what makes a re-read safe.
    if (spend && !usageByTurnId.has(spend.turnId)) usageByTurnId.set(spend.turnId, spend);

    // Kept behind `after` for the same reason spend is: the record's own id is what the store
    // deduplicates a prompt on, so a re-read appends nothing.
    const prompt = promptOf(parsed, workedIn);

    if (prompt && !promptById.has(prompt.promptId)) promptById.set(prompt.promptId, prompt);

    const record = activityOf(parsed);

    if (!record || (after && record.at.getTime() <= after.getTime())) continue;

    records.push({ ...record, workedIn: workedIn ?? record.cwd });
  }

  records.sort((a, b) => a.at.getTime() - b.at.getTime());

  const title =
    titles.custom ??
    titles.generated ??
    options.resume?.title ??
    fromPrompt(titles.firstPrompt, options.promptFallback);
  const finalIndexOf = new Map<string, number>();

  records.forEach((record, index) => finalIndexOf.set(record.sessionId, index));

  const emitted = new Map<string, { at: number; context: string }>();
  const events: AgentSessionEvent[] = [];

  const emit = (record: WorkedRecord) => {
    emitted.set(record.sessionId, { at: record.at.getTime(), context: contextOf(record) });
    events.push({
      at: record.at,
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: record.sessionId,
      cwd: record.cwd,
      gitBranch: record.gitBranch,
      workedIn: record.workedIn,
      title,
    });
  };

  records.forEach((record, index) => {
    const previous = emitted.get(record.sessionId);

    if (!previous) {
      emit(record);

      return;
    }

    const elapsed = record.at.getTime() - previous.at;
    const isFinal = finalIndexOf.get(record.sessionId) === index;

    if (previous.context !== contextOf(record) || elapsed >= interval || (isFinal && elapsed > 0)) emit(record);
  });

  const usage = [...usageByTurnId.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
  const prompts = [...promptById.values()].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { events, usage, prompts, title, session: workedIn ? { workedIn } : undefined, unparsedLines };
};
