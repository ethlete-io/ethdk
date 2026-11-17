import { format } from 'node:util';

const FAILURE_LINE = /(?:^|\s)FAILED(?:\s|$)|could not render /m;

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error'] as const;

/** The words of a failure line: `FAILED <detail>`. Printed by a design command, it makes the command exit non-zero. */
export const failedText = (detail: string) => `FAILED ${detail}`;

/** The failure line of a target that could not be rendered. Printed by a design command, it exits non-zero. */
export const couldNotRenderText = (target: string, reason: string) => `could not render ${target}: ${reason}`;

/** Whether `text` holds a failure line built by `failedText` or `couldNotRenderText`. */
export const holdsFailureLine = (text: string) => FAILURE_LINE.test(text);

const textOf = (chunk: unknown) =>
  typeof chunk === 'string' ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString() : '';

/**
 * Runs a design command and answers its exit code. Every line the command prints goes through here: a failure line on
 * stdout, stderr or the console turns 0 into 1, so a command cannot print a failure and exit 0.
 */
export const withFailureExit = async (command: () => Promise<number>): Promise<number> => {
  let failed = false;
  const streams = [process.stdout, process.stderr];
  const writes = streams.map((stream) => stream.write);
  const methods = CONSOLE_METHODS.map((name) => console[name]);

  streams.forEach((stream, index) => {
    const write = writes[index] as (...args: unknown[]) => boolean;

    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      failed ||= holdsFailureLine(textOf(chunk));

      return write.call(stream, chunk, ...rest);
    }) as typeof stream.write;
  });

  CONSOLE_METHODS.forEach((name, index) => {
    const method = methods[index] as (...args: unknown[]) => void;

    console[name] = (...args: unknown[]) => {
      failed ||= holdsFailureLine(format(...args));
      method.apply(console, args);
    };
  });

  try {
    const code = await command();

    return code === 0 && failed ? 1 : code;
  } finally {
    streams.forEach((stream, index) => (stream.write = writes[index] as typeof stream.write));
    CONSOLE_METHODS.forEach((name, index) => (console[name] = methods[index] as (typeof console)[typeof name]));
  }
};
