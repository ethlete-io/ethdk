import { inputsUnchanged, PrintedInput, trackedRun } from '../tracked-reads';

type CheckRequest = { kind: string; target: string; product: string };

/**
 * Wraps a synchronous check so it runs again only when a file or folder listing its last run for the same request
 * read prints differently; a throwing run keeps nothing.
 */
export const cachedCheckOf = <TRequest extends CheckRequest, T>(check: (request: TRequest) => T) => {
  const entries = new Map<string, { inputs: PrintedInput[]; value: T }>();

  return (request: TRequest): T => {
    const key = `${request.kind}\n${request.target}\n${request.product}`;
    const held = entries.get(key);

    if (held && inputsUnchanged(held.inputs)) return held.value;

    const { value, inputs } = trackedRun(() => check(request));

    entries.set(key, { inputs, value });

    return value;
  };
};
