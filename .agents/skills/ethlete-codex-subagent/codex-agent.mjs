#!/usr/bin/env node
/**
 * Run one Codex agent to completion and print only its final message.
 *
 * `codex exec` streams its whole reasoning and command trace to stdout. That trace costs a
 * calling agent more context than the answer is worth, so it stays in a log file here.
 *
 * Usage: node codex-agent.mjs [options] "<prompt>"
 */

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_TIMEOUT_SECONDS = 900;

const USAGE = `Usage: node codex-agent.mjs [options] "<prompt>"

  -m, --model <id>        Model id (default ${DEFAULT_MODEL})
  -e, --effort <level>    Reasoning effort: low | medium | high | xhigh
  -w, --write             Let the agent edit the working tree (default: read-only)
  -C, --cd <dir>          Working root for the agent (default: the current directory)
      --resume <thread>   Continue an earlier thread instead of starting one
      --prompt-file <f>   Read the prompt from a file
      --schema <file>     JSON Schema the final message must match
      --timeout <sec>     Give up after this many seconds (default ${DEFAULT_TIMEOUT_SECONDS})
      --trace             Also print the command and file-change trace
  -h, --help              Print this help`;

const parseArgs = (argv) => {
  const options = {
    model: DEFAULT_MODEL,
    effort: '',
    write: false,
    cd: process.cwd(),
    resume: '',
    promptFile: '',
    schema: '',
    timeout: DEFAULT_TIMEOUT_SECONDS,
    trace: false,
    prompt: '',
  };

  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value.`);
      return argv[index];
    };

    if (arg === '-m' || arg === '--model') options.model = next();
    else if (arg === '-e' || arg === '--effort') options.effort = next();
    else if (arg === '-w' || arg === '--write') options.write = true;
    else if (arg === '-C' || arg === '--cd') options.cd = next();
    else if (arg === '--resume') options.resume = next();
    else if (arg === '--prompt-file') options.promptFile = next();
    else if (arg === '--schema') options.schema = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg === '--trace') options.trace = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg.startsWith('-') && arg !== '-') throw new Error(`Unknown option ${arg}.`);
    else rest.push(arg);
  }

  options.prompt = options.promptFile ? readFileSync(options.promptFile, 'utf8') : rest.join(' ');

  return options;
};

const readStdin = () =>
  new Promise((resolve) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buffer += chunk));
    process.stdin.on('end', () => resolve(buffer));
  });

const buildArgs = (options, lastMessageFile) => {
  const args = ['exec'];

  if (options.resume) args.push('resume');

  args.push('--json', '--skip-git-repo-check', '-o', lastMessageFile, '-m', options.model);

  // `codex exec resume` carries the sandbox and the working root of the session it resumes,
  // and rejects both flags, so only a fresh run may pass them.
  if (!options.resume) {
    args.push('-C', options.cd, '--sandbox', options.write ? 'workspace-write' : 'read-only');
  }

  if (options.effort) args.push('-c', `model_reasoning_effort="${options.effort}"`);
  if (options.schema) args.push('--output-schema', options.schema);
  if (options.resume) args.push(options.resume);

  args.push('-');

  return args;
};

const describeItem = (item) => {
  if (item.type === 'command_execution') return `$ ${String(item.command ?? '').split('\n')[0]}`;
  if (item.type === 'file_change') {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    return `~ ${changes.map((change) => `${change.kind ?? 'edit'} ${change.path ?? ''}`).join(', ')}`;
  }
  if (item.type === 'error') return `! ${item.message ?? 'unknown error'}`;
  return '';
};

const duration = (milliseconds) => {
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (!options.prompt.trim() && !process.stdin.isTTY) options.prompt = await readStdin();

  if (!options.prompt.trim()) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  const logDir = join(tmpdir(), 'codex-agent');
  mkdirSync(logDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = join(logDir, `${stamp}.jsonl`);
  const lastMessageFile = join(logDir, `${stamp}.last.md`);
  const log = createWriteStream(logFile);
  const started = Date.now();

  const child = spawn('codex', buildArgs(options, lastMessageFile), {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdin.end(options.prompt);

  const state = { thread: '', usage: null, errors: [], trace: [], failed: false };

  createInterface({ input: child.stdout }).on('line', (line) => {
    log.write(`${line}\n`);

    let event;

    try {
      event = JSON.parse(line);
    } catch {
      return;
    }

    if (event.type === 'thread.started') state.thread = event.thread_id ?? '';
    else if (event.type === 'turn.completed') state.usage = event.usage ?? null;
    else if (event.type === 'turn.failed') {
      state.failed = true;
      state.errors.push(event.error?.message ?? 'the turn failed');
    } else if (event.type === 'item.completed') {
      const description = describeItem(event.item ?? {});
      if (description) state.trace.push(description);
      if (event.item?.type === 'error') state.errors.push(event.item.message ?? 'unknown error');
    }
  });

  let stderrText = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => (stderrText += chunk));

  const timer = setTimeout(() => child.kill('SIGKILL'), Math.max(1, options.timeout) * 1000);
  const code = await new Promise((resolve) => child.on('close', resolve));

  clearTimeout(timer);
  log.end();

  let finalMessage;

  try {
    finalMessage = readFileSync(lastMessageFile, 'utf8').trim();
    rmSync(lastMessageFile, { force: true });
  } catch {
    finalMessage = '';
  }

  const failed = code !== 0 || state.failed || (!finalMessage && state.errors.length > 0);

  if (options.trace && state.trace.length > 0) process.stdout.write(`${state.trace.join('\n')}\n\n`);
  if (finalMessage) process.stdout.write(`${finalMessage}\n`);

  if (failed) {
    const reason = state.errors.join('\n') || stderrText.trim() || `codex exited with code ${code}`;
    process.stdout.write(`\ncodex agent FAILED: ${reason}\n`);
  }

  const parts = [
    `codex ${options.model}`,
    options.write ? 'workspace-write' : 'read-only',
    duration(Date.now() - started),
  ];

  if (state.usage) parts.push(`${state.usage.output_tokens ?? 0} out tok`);

  process.stdout.write(`\n--- ${parts.join(' · ')}\n`);

  if (state.thread) process.stdout.write(`resume: --resume ${state.thread}\n`);

  process.stdout.write(`log: ${logFile}\n`);

  return failed ? 1 : 0;
};

run().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  },
);
