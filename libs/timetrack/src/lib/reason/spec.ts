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

/** One isolated agent-CLI run: a system prompt, a JSON schema to answer in, and a payload on stdin. */
export const agentProcessSpec = (options: {
  systemPrompt: string;
  schema: unknown;
  stdin: string;
  ask: ModelAsk;
  options?: Partial<ReasoningOptions>;
}): ProcessSpec => {
  const settings = { ...DEFAULT_REASONING_OPTIONS, ...options.options };

  return {
    command: settings.command,
    args: [
      ...ISOLATION_ARGS,
      '--system-prompt',
      options.systemPrompt + languageInstruction(settings.language),
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(options.schema),
      ...(settings.model ? ['--model', settings.model] : []),
    ],
    stdin: options.stdin,
    timeoutMs: settings.timeoutMs,
    ask: options.ask,
  };
};
