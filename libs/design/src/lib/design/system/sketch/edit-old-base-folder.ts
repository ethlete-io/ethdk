import { join, sep } from 'path';

export const EDIT_OLD_BASE_FOLDER = join('node_modules', '.cache', 'ethlete-design', 'edit-old-base');

const MARKER = `${sep}${EDIT_OLD_BASE_FOLDER}${sep}`;

/** Whether `file` belongs to the snapshot an edit sketch's `old` variant draws its other parts from, not to the variant. */
export const isEditOldBaseFile = (file: string) => file.includes(MARKER);

export const workingTreeFileOf = (file: string) => {
  const at = file.indexOf(MARKER);

  if (at < 0) return file;

  const [, copy, ...path] = file.slice(at + MARKER.length).split(sep);

  return copy === 'raw' || copy === 'drawn' ? join(file.slice(0, at), ...path) : file;
};
