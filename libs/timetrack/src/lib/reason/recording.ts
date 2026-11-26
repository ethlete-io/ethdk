import { defer, tap } from 'rxjs';
import { ModelAsk, ProcessSpec, TimetrackProcessRunner } from '../transport/ports';

/** One model call as it left the machine and as it came back, for a debug view. */
export type ModelCall = {
  id: number;
  ask: ModelAsk;
  command: string;
  args: readonly string[];
  /** What the call wrote to the CLI's standard input, where it wrote anything. */
  stdin?: string;
  startedAtMs: number;
  endedAtMs?: number;
  code?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

/**
 * Wraps the process runner so every model call through it is reported twice: once when it starts and
 * once when it ends, under the same id. A run that names no `ask` is not a model call and is not reported.
 */
export const recordingRunner = (options: {
  runner: TimetrackProcessRunner;
  record: (call: ModelCall) => void;
  now?: () => number;
}): TimetrackProcessRunner => {
  const now = options.now ?? Date.now;
  let nextId = 0;

  return {
    run$: (spec: ProcessSpec) => {
      const ask = spec.ask;

      if (!ask) return options.runner.run$(spec);

      return defer(() => {
        const started: ModelCall = {
          id: nextId++,
          ask,
          command: spec.command,
          args: [...spec.args],
          ...(spec.stdin !== undefined ? { stdin: spec.stdin } : {}),
          startedAtMs: now(),
        };

        options.record(started);

        return options.runner.run$(spec).pipe(
          tap({
            next: (result) =>
              options.record({
                ...started,
                endedAtMs: now(),
                code: result.code,
                stdout: result.stdout,
                stderr: result.stderr,
              }),
            error: (error: unknown) =>
              options.record({
                ...started,
                endedAtMs: now(),
                error: error instanceof Error ? error.message : String(error),
              }),
          }),
        );
      });
    },
  };
};
