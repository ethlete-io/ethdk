import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CommentPoint, isPoint } from '../comments/comment';
import { newNoteId } from '../notes/note';

export type FlowState = { part: string; state: string };

/** `position` is the frame's top-left corner on the flow canvas in CSS pixels; without one Studio lays the frame out. */
export type FlowFrame = FlowState & { position?: CommentPoint };

/** `transition: 'view'` makes `et design motion flow` animate the line as a same-document View Transition; `id` names it there. */
export type FlowLine = { from: FlowState; to: FlowState; label?: string; id?: string; transition?: 'view' };

/** A note of the flow itself, such as a heading over a group of frames; `at` is its top-left corner on the flow canvas, and may be negative. */
export type FlowNote = { id: string; text: string; at?: CommentPoint };

export type FlowFile = { frames: FlowFrame[]; lines?: FlowLine[]; notes?: FlowNote[] };

export type DesignFlow = { name: string; file: string; frames: FlowFrame[]; lines: FlowLine[]; notes: FlowNote[] };

/** What a change sets: a new text, a new place, or `at: null` to let Studio place the note. */
export type FlowNoteChange = { text?: string; at?: CommentPoint | null };

export const flowsDirOf = (productDir: string) => resolve(productDir, 'flows');

export const flowStateKeyOf = (state: FlowState) => `${state.part}#${state.state}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const FLOW_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

const isCanvasPoint = (value: unknown): value is CommentPoint =>
  isRecord(value) && Number.isFinite(value['x']) && Number.isFinite(value['y']);

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
  (line['label'] === undefined || isText(line['label'])) &&
  (line['id'] === undefined || isText(line['id'])) &&
  (line['transition'] === undefined || line['transition'] === 'view')
    ? null
    : `lines[${index}] must be { from: { part, state }, to: { part, state }, label?, id?, transition?: "view" }`;

const noteProblemOf = (note: unknown, index: number) =>
  isRecord(note) &&
  isText(note['id']) &&
  isText(note['text']) &&
  (note['at'] === undefined || isCanvasPoint(note['at']))
    ? null
    : `notes[${index}] must be { id, text, at?: { x, y } }, at in CSS pixels on the flow canvas`;

const shapeProblemOf = (value: unknown) => {
  if (!isRecord(value)) return 'must be a JSON object { frames, lines?, notes? }';
  if (!Array.isArray(value['frames'])) return 'frames must be a list';
  if (value['lines'] !== undefined && !Array.isArray(value['lines'])) return 'lines must be a list';
  if (value['notes'] !== undefined && !Array.isArray(value['notes'])) return 'notes must be a list';

  const problem =
    value['frames'].map(frameProblemOf).find((found) => found !== null) ??
    ((value['lines'] as unknown[] | undefined) ?? []).map(lineProblemOf).find((found) => found !== null) ??
    ((value['notes'] as unknown[] | undefined) ?? []).map(noteProblemOf).find((found) => found !== null);

  return problem ?? null;
};

const flowOf = ({ parsed, name, file }: { parsed: FlowFile; name: string; file: string }): DesignFlow => ({
  name,
  file,
  frames: parsed.frames.map(({ part, state, position }) => ({ part, state, ...(position ? { position } : {}) })),
  lines: (parsed.lines ?? []).map(({ from, to, label, id, transition }) => ({
    from: { part: from.part, state: from.state },
    to: { part: to.part, state: to.state },
    ...(label ? { label } : {}),
    ...(id ? { id } : {}),
    ...(transition ? { transition } : {}),
  })),
  notes: (parsed.notes ?? []).map(({ id, text, at }) => ({ id, text, ...(at ? { at } : {}) })),
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

const readFlowFile = (productDir: string, name: string) => {
  if (!FLOW_NAME.test(name)) return `"${name}" is no flow name`;

  const file = resolve(flowsDirOf(productDir), `${name}.json`);

  if (!existsSync(file)) return `no flow "${name}"`;

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const problem = shapeProblemOf(parsed);

    return problem ? `flows/${name}.json ${problem} - fix it first` : { file, parsed: parsed as FlowFile };
  } catch (error) {
    return `flows/${name}.json is no JSON - fix it first: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/** Rewrites only the `notes` of a readable flow file; every other key, unknown ones too, stays as it was. */
const withFlowNotes = <T>(options: {
  productDir: string;
  name: string;
  update: (notes: FlowNote[]) => { notes: FlowNote[]; answer: T } | string;
}): T | string => {
  const read = readFlowFile(options.productDir, options.name);

  if (typeof read === 'string') return read;

  const updated = options.update(read.parsed.notes ?? []);

  if (typeof updated === 'string') return updated;

  const problem = updated.notes.map(noteProblemOf).find((found) => found !== null);

  if (problem) return problem;

  const written = Object.fromEntries(
    Object.entries({ ...read.parsed, notes: updated.notes }).filter(
      ([key, value]) => key !== 'notes' || (value as FlowNote[]).length > 0,
    ),
  );

  writeFileSync(read.file, `${JSON.stringify(written, null, 2)}\n`);

  return updated.answer;
};

const noNoteIn = (name: string, id: string) => `flow "${name}" has no note "${id}"`;

/** Adds a free note to a flow file. Answers with the note, or with why the flow cannot take it. */
export const addFlowNote = (options: {
  productDir: string;
  name: string;
  note: Omit<FlowNote, 'id'>;
}): FlowNote | string => {
  const { text, at } = options.note;
  const note: FlowNote = { id: newNoteId(), text, ...(at === undefined ? {} : { at }) };

  return withFlowNotes({ ...options, update: (notes) => ({ notes: [...notes, note], answer: note }) });
};

/** Changes the text or the place of a free note in a flow file. Answers with the changed note. */
export const changeFlowNote = (options: {
  productDir: string;
  name: string;
  id: string;
  change: FlowNoteChange;
}): FlowNote | string => {
  const { name, id, change } = options;

  return withFlowNotes({
    ...options,
    update: (notes) => {
      const found = notes.find((note) => note.id === id);

      if (!found) return noNoteIn(name, id);

      const { at: before, ...rest } = found;
      const at = change.at === undefined ? before : (change.at ?? undefined);
      const changed: FlowNote = { ...rest, text: change.text ?? found.text, ...(at ? { at } : {}) };

      return { notes: notes.map((note) => (note.id === id ? changed : note)), answer: changed };
    },
  });
};

/** Deletes a free note from a flow file. Answers with the deleted note. */
export const deleteFlowNote = (options: { productDir: string; name: string; id: string }): FlowNote | string => {
  const { name, id } = options;

  return withFlowNotes({
    ...options,
    update: (notes) => {
      const found = notes.find((note) => note.id === id);

      return found ? { notes: notes.filter((note) => note !== found), answer: found } : noNoteIn(name, id);
    },
  });
};
