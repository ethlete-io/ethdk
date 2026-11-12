import { statSync } from 'fs';
import { isAbsolute, sep } from 'path';

const NODE_MODULES = `${sep}node_modules${sep}`;

export const sourceChangedSince = (files: Iterable<string>, since: number) => {
  for (const file of files) {
    if (!isAbsolute(file) || file.includes(NODE_MODULES)) continue;

    const changedAt = statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? Infinity;

    if (changedAt > since) return true;
  }

  return false;
};

export const loadedFilesOf = (server: {
  environments: Record<string, { moduleGraph: { fileToModulesMap: Map<string, unknown> } }>;
}) => Object.values(server.environments).flatMap((environment) => [...environment.moduleGraph.fileToModulesMap.keys()]);
