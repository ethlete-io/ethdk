import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { CommentPoint, isPoint } from '../comments/comment';

export type NoteFile = { part: string; state: string; point?: CommentPoint; text: string };

export type DesignNote = NoteFile & { id: string; file: string };

export const notesDirOf = (productDir: string) => resolve(productDir, 'notes');

const shapeProblemOf = (value: Partial<NoteFile>) => {
  for (const key of ['part', 'state', 'text'] as const)
    if (typeof value[key] !== 'string' || value[key] === '') return `${key} must be a non-empty string`;

  return value.point !== undefined && !isPoint(value.point) ? 'point must be { x, y } in CSS pixels, both >= 0' : null;
};

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
