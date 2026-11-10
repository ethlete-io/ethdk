const CSP = 'Content Security Policy';

const argText = (arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? `[${arg.type}]`;

const problemOf = ({ method, params }) => {
  if (method === 'Log.entryAdded' && params.entry.level === 'error') {
    return { text: params.entry.text, url: params.entry.url };
  }

  if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'assert')) {
    return { text: params.args.map(argText).join(' '), url: params.stackTrace?.callFrames[0]?.url };
  }

  if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails;

    return { text: details.exception?.description ?? details.text, url: details.url };
  }

  return undefined;
};

/**
 * Sorts recorded CDP events (`{ method, params }`) into CSP refusals and other console errors, each line once with
 * the number of times it was seen.
 */
export const consoleProblems = (events) => {
  const counts = new Map();

  for (const event of events) {
    const problem = problemOf(event);

    if (!problem) continue;

    const line = problem.text.split('\n')[0];
    const seen = counts.get(line) ?? { line, url: problem.url, count: 0, refusal: line.includes(CSP) };

    seen.count += 1;
    counts.set(line, seen);
  }

  const all = [...counts.values()];

  return { refusals: all.filter((p) => p.refusal), errors: all.filter((p) => !p.refusal) };
};
