/**
 * Who set a field auto mode can also set: the user (`human`), auto mode (`auto`), or nobody, so the
 * value is what the engine observed (`observed`). Auto mode never writes a `human` field.
 */
export type FieldSource = 'human' | 'auto' | 'observed';

/** The source a write carries. Every press in the UI and every approved agent write is `human`. */
export type WriteSource = Exclude<FieldSource, 'observed'>;

/** The fields of a row auto mode can set. `issue` covers a stand-in naming too: one field to the user. */
export type RowField = 'issue' | 'description';

export type RowFieldSources = Partial<Record<RowField, FieldSource>>;

/** Whether auto mode may write a field that holds this source. */
export const mayAutoWrite = (source: FieldSource) => source !== 'human';

/** Whether a write from `source` may replace a field that holds `current`. */
export const mayWrite = (options: { source: WriteSource; current: FieldSource }) =>
  options.source === 'human' || mayAutoWrite(options.current);

/**
 * The source of a stored value. A value stored before fields carried a source is the user's: every
 * write then was a press in the UI or an agent write the user asked for.
 */
export const storedSourceOf = (options: { set: boolean; source?: FieldSource }): FieldSource =>
  options.source ?? (options.set ? 'human' : 'observed');

/** The source of one field of a reviewed row. A row nobody edited holds what the engine observed. */
export const rowFieldSourceOf = (row: { sources?: RowFieldSources }, field: RowField): FieldSource =>
  row.sources?.[field] ?? 'observed';
