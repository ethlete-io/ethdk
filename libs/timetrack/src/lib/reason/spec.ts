import { ModelAsk, ProcessSpec } from '../transport/ports';
import { DEFAULT_REASONING_OPTIONS, ReasoningOptions } from './model';

/**
 * The flags that make the call a one-shot question rather than a coding session.
 *
 * `--safe-mode` is what `--bare` was meant to be here: it drops hooks, skills, plugins, MCP servers,
 * custom agents and `CLAUDE.md` discovery, but leaves authentication alone. `--bare` cannot be used —
 * it reads `ANTHROPIC_API_KEY` only, and the whole point of spawning a CLI is to use the subscription
 * the user already has. `--tools ""` disables every built-in tool, so the run has no filesystem and no
 * network of its own; the prompt on stdin is all it can see.
 */
const ISOLATION_ARGS = ['--print', '--safe-mode', '--no-session-persistence', '--strict-mcp-config', '--tools', ''];

/**
 * The user's language, appended last so it outranks the rule each prompt already carries about
 * following the evidence. A prompt that named the language itself would have to name it four times,
 * and one of them would go stale.
 */
export const languageInstruction = (language: string) => {
  const named = language.trim();

  return named
    ? `\n\nWrite every word you answer in ${named}, whatever language the evidence or this instruction is in. ` +
        'This overrides any rule above about following the language of the evidence. Never translate an issue key, ' +
        'a repository name, a branch name or a quoted identifier.'
    : '';
};

/**
 * Codex has no flag that removes every tool, so each feature that reaches the filesystem, the network
 * or another agent is switched off one by one, and the read-only sandbox catches whatever a newer
 * release adds. `code_mode_host` off makes code mode fail closed rather than run.
 */
const CODEX_ISOLATION_ARGS = [
  'exec',
  '--json',
  '--ephemeral',
  '--skip-git-repo-check',
  '--ignore-rules',
  '--sandbox',
  'read-only',
  '-c',
  'approval_policy="never"',
  '-c',
  'web_search="disabled"',
  '-c',
  'mcp_servers={}',
  ...[
    'shell_tool',
    'unified_exec',
    'code_mode_host',
    'multi_agent',
    'goals',
    'view_image',
    'plugins',
    'apps',
    'browser_use',
    'computer_use',
    'image_generation',
    'hooks',
  ].flatMap((feature) => ['--disable', feature]),
];

/**
 * `codex exec` takes a schema only as a file, and the host spawns processes without writing one, so the
 * schema travels in the instructions and the reader validates the answer instead.
 */
const codexInstructions = (systemPrompt: string, schema: unknown) =>
  `${systemPrompt}\n\nAnswer with exactly one JSON document and nothing else, with no code fence, matching this JSON Schema:\n${JSON.stringify(schema)}`;

const claudeArgs = (options: { systemPrompt: string; schema: unknown; model: string }) => [
  ...ISOLATION_ARGS,
  '--system-prompt',
  options.systemPrompt,
  '--output-format',
  'json',
  '--json-schema',
  JSON.stringify(options.schema),
  ...(options.model ? ['--model', options.model] : []),
];

/** A JSON string is a valid TOML basic string, which is what `-c` parses its value as. */
const codexArgs = (options: { systemPrompt: string; schema: unknown; model: string }) => [
  ...CODEX_ISOLATION_ARGS,
  '-c',
  `developer_instructions=${JSON.stringify(codexInstructions(options.systemPrompt, options.schema))}`,
  ...(options.model ? ['--model', options.model] : []),
  '-',
];

/** One isolated agent-CLI run: a system prompt, a JSON schema to answer in, and a payload on stdin. */
export const agentProcessSpec = (options: {
  systemPrompt: string;
  schema: unknown;
  stdin: string;
  ask: ModelAsk;
  options?: Partial<ReasoningOptions>;
}): ProcessSpec => {
  const settings = { ...DEFAULT_REASONING_OPTIONS, ...options.options };
  const args = {
    systemPrompt: options.systemPrompt + languageInstruction(settings.language),
    schema: options.schema,
    model: settings.model,
  };

  return {
    command: settings.command,
    args: settings.command === 'codex' ? codexArgs(args) : claudeArgs(args),
    stdin: options.stdin,
    timeoutMs: settings.timeoutMs,
    ask: options.ask,
  };
};
