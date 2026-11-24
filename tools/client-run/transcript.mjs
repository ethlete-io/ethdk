const FAILED = /^Exit code [1-9]/m;

const textOf = (content) =>
  typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('\n');

/** The design command a Bash line runs, as `<subcommand words>` after `design`, e.g. `sketch ready`; null for others. */
export const designCommandOf = (command) => {
  for (const line of command.split(/\n|&&|;|\|\|/)) {
    const words = line.trim().split(/\s+/);
    const at = words.findIndex(
      (word, i) => word === 'design' && /(^|\/)(et|index\.js)$|^\$ET$|^"\$ET"$/.test(words[i - 1] ?? ''),
    );
    if (at < 0) continue;
    const sub = [];
    for (const word of words.slice(at + 1, at + 3)) {
      if (!/^[a-z][a-z-]*$/.test(word)) break;
      sub.push(word);
    }
    return sub.join(' ') || 'serve';
  }
  return null;
};

/** Reads a `claude -p --output-format stream-json` transcript into its design calls and the agent's last message. */
export const readTranscript = (text) => {
  const events = text
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => JSON.parse(line));
  const calls = new Map();
  const ordered = [];
  let result = null;
  for (const event of events) {
    if (event.type === 'result')
      result = { text: event.result ?? '', isError: !!event.is_error, turns: event.num_turns };
    for (const part of event.message?.content ?? []) {
      if (part.type === 'tool_use') {
        const command = part.name === 'Bash' ? designCommandOf(part.input?.command ?? '') : null;
        const key =
          command ?? (/^mcp__.*design/.test(part.name) ? part.name.replace(/^mcp__[^_]+(?:-[^_]+)*__/, '') : null);
        if (!key) continue;
        const call = {
          id: part.id,
          key,
          input: part.name === 'Bash' ? part.input.command : JSON.stringify(part.input),
        };
        calls.set(part.id, call);
        ordered.push(call);
      }
      if (part.type === 'tool_result' && calls.has(part.tool_use_id)) {
        const call = calls.get(part.tool_use_id);
        call.output = textOf(part.content);
        call.failed = !!part.is_error || FAILED.test(call.output);
      }
    }
  }
  return { calls: ordered, result };
};

/** The design calls that failed or refused and that no later call of the same command passed: what the agent left. */
export const leftRefusalsOf = ({ calls }) =>
  calls.filter(
    (call, i) => call.failed && !calls.slice(i + 1).some((later) => later.key === call.key && later.failed === false),
  );
