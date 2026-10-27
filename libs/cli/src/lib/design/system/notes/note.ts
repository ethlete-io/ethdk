import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { CommentPoint, CommentSize, FITTED, goneSizeOf, goneStateOf, isPoint, isSize } from '../comments/comment';
import { ResolvedProduct } from '../resolve-product';

/** A note on a state of a part; a pointed note names the `size` it was written at and shows only there. */
export type NoteFile = { part: string; state: string; point?: CommentPoint; size?: CommentSize; text: string };

export type DesignNote = NoteFile & { id: string; file: string };

/** What a change sets: a new text, a new point at a size, or `point: null` to pin the note to the whole state. */
export type NoteChange = { text?: string; point?: CommentPoint | null; size?: CommentSize };

const NOTE_ID = /^[A-Za-z0-9-]+$/u;

export const notesDirOf = (productDir: string) => resolve(productDir, 'notes');

/** A new note id: the time it was written and a random suffix, as comment ids are. */
export const newNoteId = () =>
  `${new Date()
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d+Z$/u, 'Z')}-${randomBytes(2).toString('hex')}`;

const SIZE_PROBLEM = `size must be a preset name, a width in CSS pixels or "${FITTED}"`;

export const MISSING_NOTE_SIZE = `a pointed note needs the size it was written at - add size: a preset name, a width in CSS pixels or "${FITTED}"`;

const shapeProblemOf = (value: Partial<NoteFile>) => {
  for (const key of ['part', 'state', 'text'] as const)
    if (typeof value[key] !== 'string' || value[key].trim() === '') return `${key} must be a non-empty string`;

  if (value.point !== undefined && !isPoint(value.point)) return 'point must be { x, y } in CSS pixels, both >= 0';

  return value.size !== undefined && !isSize(value.size) ? SIZE_PROBLEM : null;
};

/** Why a note points at nothing: its part, state or size is gone, or a pointed note names no size. `null` when it does. */
export const noteProblemOf = (options: { product: ResolvedProduct; note: NoteFile }) => {
  const { product, note } = options;

  return (
    goneStateOf({ product, part: note.part, state: note.state }) ??
    (note.point && note.size === undefined ? MISSING_NOTE_SIZE : null) ??
    (note.point && note.size !== undefined ? goneSizeOf({ product, part: note.part, size: note.size }) : null)
  );
};

const writeNote = (file: string, note: NoteFile) => writeFileSync(file, `${JSON.stringify(note, null, 2)}\n`);

/** Every note on a state of a product, `<product>/notes/<id>.json`; a file that cannot be read answers with its problem. */
export const listNotes = (productDir: string) => {
  const dir = notesDirOf(productDir);
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  const read = files.sort().map((name): DesignNote | { file: string; problem: string } => {
    const file = resolve(dir, name);

    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<NoteFile>;
      const problem = shapeProblemOf(parsed);

      return problem ? { file, problem } : { ...(parsed as NoteFile), id: name.slice(0, -'.json'.length), file };
    } catch (error) {
      return { file, problem: `is no JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
  });

  return {
    notes: read.filter((entry): entry is DesignNote => !('problem' in entry)),
    unreadable: read.filter((entry): entry is { file: string; problem: string } => 'problem' in entry),
  };
};

/** Writes a note on a state of a part, or answers with why it cannot: a bad shape or a part or state that is gone. */
export const createNote = (options: { product: ResolvedProduct; note: NoteFile }): DesignNote | string => {
  const { product } = options;
  const { part, state, point, size, text } = options.note;
  const note: NoteFile = {
    part,
    state,
    ...(point === undefined ? {} : { point, ...(size === undefined ? {} : { size }) }),
    text,
  };
  const problem = shapeProblemOf(note) ?? noteProblemOf({ product, note });

  if (problem) return problem;

  const dir = notesDirOf(product.dir);
  const id = newNoteId();
  const file = resolve(dir, `${id}.json`);

  mkdirSync(dir, { recursive: true });
  writeNote(file, note);

  return { ...note, id, file };
};

const findNote = (productDir: string, id: string) => {
  if (!NOTE_ID.test(id)) return `"${id}" is no note id`;

  return listNotes(productDir).notes.find((note) => note.id === id) ?? `no note "${id}"`;
};

/** Changes the text or the point of a note and keeps the rest of it. Answers with the changed note. */
export const changeNote = (options: { productDir: string; id: string; change: NoteChange }): DesignNote | string => {
  const found = findNote(options.productDir, options.id);

  if (typeof found === 'string') return found;

  const { text = found.text, point, size } = options.change;
  const { id, file, point: before, size: sizeBefore, ...rest } = found;
  const kept = point === undefined ? before : (point ?? undefined);
  const keptSize = size ?? sizeBefore;
  const note: NoteFile = {
    ...rest,
    ...(kept ? { point: kept, ...(keptSize === undefined ? {} : { size: keptSize }) } : {}),
    text,
  };
  const problem = shapeProblemOf(note);

  if (problem) return problem;

  writeNote(file, note);

  return { ...note, id, file };
};

/** Deletes a note by its id. Answers with the deleted note. */
export const deleteNote = (options: { productDir: string; id: string }): DesignNote | string => {
  const found = findNote(options.productDir, options.id);

  if (typeof found !== 'string') rmSync(found.file);

  return found;
};
