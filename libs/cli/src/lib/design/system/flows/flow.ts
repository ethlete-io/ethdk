import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { CommentPoint, isPoint } from '../comments/comment';

export type FlowState = { part: string; state: string };

/** `position` is the frame's top-left corner on the flow canvas in CSS pixels; without one Studio lays the frame out. */
export type FlowFrame = FlowState & { position?: CommentPoint };

export type FlowLine = { from: FlowState; to: FlowState; label?: string };

export type FlowFile = { frames: FlowFrame[]; lines?: FlowLine[] };

export type DesignFlow = { name: string; file: string; frames: FlowFrame[]; lines: FlowLine[] };

export const flowsDirOf = (productDir: string) => resolve(productDir, 'flows');

export const flowStateKeyOf = (state: FlowState) => `${state.part}#${state.state}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

const isState = (value: unknown): value is FlowState =>
  isRecord(value) && isText(value['part']) && isText(value['state']);

const frameProblemOf = (frame: unknown, index: number) => {
  if (!isState(frame)) return `frames[${index}] must be { part: "<layer>/<name>", state, position? }`;

  const { position } = frame as FlowFrame;

  return position !== undefined && !isPoint(position)
    ? `frames[${index}].position must be { x, y } in CSS pixels, both >= 0`
    : null;
};

const lineProblemOf = (line: unknown, index: number) =>
  isRecord(line) &&
  isState(line['from']) &&
  isState(line['to']) &&
  (line['label'] === undefined || isText(line['label']))
    ? null
    : `lines[${index}] must be { from: { part, state }, to: { part, state }, label? }`;

const shapeProblemOf = (value: unknown) => {
  if (!isRecord(value)) return 'must be a JSON object { frames, lines? }';
  if (!Array.isArray(value['frames'])) return 'frames must be a list';
  if (value['lines'] !== undefined && !Array.isArray(value['lines'])) return 'lines must be a list';

  const problem =
    value['frames'].map(frameProblemOf).find((found) => found !== null) ??
    ((value['lines'] as unknown[] | undefined) ?? []).map(lineProblemOf).find((found) => found !== null);

  return problem ?? null;
};

const flowOf = ({ parsed, name, file }: { parsed: FlowFile; name: string; file: string }): DesignFlow => ({
  name,
  file,
  frames: parsed.frames.map(({ part, state, position }) => ({ part, state, ...(position ? { position } : {}) })),
  lines: (parsed.lines ?? []).map(({ from, to, label }) => ({
    from: { part: from.part, state: from.state },
    to: { part: to.part, state: to.state },
    ...(label ? { label } : {}),
  })),
});

/** Every flow of a product, `<product>/flows/<name>.json`, by name; a file that cannot be read answers with its problem. */
export const listFlows = (productDir: string) => {
  const dir = flowsDirOf(productDir);
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  const read = files.sort().map((name): DesignFlow | { file: string; problem: string } => {
    const file = resolve(dir, name);

    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      const problem = shapeProblemOf(parsed);

      return problem
        ? { file, problem }
        : flowOf({ parsed: parsed as FlowFile, name: name.slice(0, -'.json'.length), file });
    } catch (error) {
      return { file, problem: `is no JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
  });

  return {
    flows: read.filter((entry): entry is DesignFlow => !('problem' in entry)),
    unreadable: read.filter((entry): entry is { file: string; problem: string } => 'problem' in entry),
  };
};
