export const CANVAS_OPTIONS = [
  ['--case <name>', 'run only the cases whose name matches'],
  ['--page <A|B>', 'run only the cases of these pages'],
  ['--view <system|sketches|flow>', 'run only the pages of one view'],
  ['--list', 'print the case names and exit'],
  ['--built <dir>', 'use an existing build of ethlete-studio'],
  ['--engine <name>', 'browser engine (default chromium)'],
  ['--shard <i/n>', 'run one shard of the cases'],
  ['--workers <n>', 'number of parallel workers'],
  ['--load <n>', 'run n CPU-load processes beside the run'],
  ['--proof <row>', 'write the proof for a row'],
  ['--perf', 'run the performance cases only'],
  ['--no-wait-lock', 'fail instead of waiting for the heavy lock'],
  ['--no-timings', 'do not update the shard weights'],
  ['--cold-shots', 'draw shots without warming the cache'],
  ['--hold-listings <ms>', 'hold directory listings for ms'],
  ['--delay-pictures <ms>', 'delay picture responses by ms'],
  ['--delay-frames <ms>', 'delay frame responses by ms'],
  ['--cpu-rate <n>', 'throttle the CPU n times'],
  ['--zoom-fixture', 'prepare the zoom fixture'],
  ['--prepare-checkout', 'prepare the checkout and exit'],
  ['--check-fixtures', 'check the sketch fixtures'],
  ['--worker', 'internal: run as a worker process'],
  ['--help', 'print this text and exit'],
];

export const usageOf = ({ script, options }) =>
  `Usage: node ${script} [options]\n\nOptions:\n${options
    .map(([flag, text]) => `  ${flag.padEnd(32)}${text}`)
    .join('\n')}`;

/** Classifies argv: `help` for --help/-h, `unknown` for the first `--option` or `-x` not in `options`, else `ok`. */
export const argvCheckOf = ({ args, options }) => {
  if (args.includes('--help') || args.includes('-h')) return { kind: 'help' };

  const known = new Set(options.map(([flag]) => flag.split(' ')[0]));
  const unknown = args.find((arg) => arg.startsWith('-') && arg.length > 1 && !known.has(arg));

  return unknown ? { kind: 'unknown', option: unknown } : { kind: 'ok' };
};
