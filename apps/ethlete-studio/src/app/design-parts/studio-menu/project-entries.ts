export type ProjectEntry = {
  id: string;
  name: string;
  hint: string;
  run: string | null;
};

const CLIENT_RUN = /[\\/]client-runs[\\/](\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})[\\/]/;

const folderNameOf = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

const parentNameOf = (path: string) => path.split(/[\\/]/).filter(Boolean).slice(-3, -1).join('/');

export const runLabelOf = (path: string) => {
  const match = CLIENT_RUN.exec(path);

  return match ? `${match[3]}.${match[2]}. ${match[4]}:${match[5]}` : null;
};

export const projectEntriesOf = (paths: readonly string[]): ProjectEntry[] => {
  const names: string[] = paths.map(folderNameOf);

  return paths.map((id, index) => {
    const run = runLabelOf(id);
    const shared = paths.filter((other, at) => !runLabelOf(other) && names[at] === names[index]).length > 1;

    return { id, name: names[index] ?? id, run, hint: run ?? (shared ? parentNameOf(id) : '') };
  });
};
