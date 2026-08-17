import { ProcessSpec } from '../transport/ports';
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

/** One isolated agent-CLI run: a system prompt, a JSON schema to answer in, and a payload on stdin. */
export const agentProcessSpec = (options: {
  systemPrompt: string;
  schema: unknown;
  stdin: string;
  options?: Partial<ReasoningOptions>;
}): ProcessSpec => {
  const settings = { ...DEFAULT_REASONING_OPTIONS, ...options.options };

  return {
    command: settings.command,
    args: [
      ...ISOLATION_ARGS,
      '--system-prompt',
      options.systemPrompt,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(options.schema),
      ...(settings.model ? ['--model', settings.model] : []),
    ],
    stdin: options.stdin,
    timeoutMs: settings.timeoutMs,
  };
};
