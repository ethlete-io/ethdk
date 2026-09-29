import { Tree } from '@nx/devkit';
import { createMigrationScope, MigrationScope } from '../migrate-provider-shape/migration-scope.js';

export type TransformReport = {
  filesChanged: number;
  review: string[];
};

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.angular', '.nx']);

export const collectFiles = (tree: Tree, scope: MigrationScope | undefined, extensions: string[]) => {
  const files: string[] = [];

  (scope ?? createMigrationScope(tree, {})).visit(tree, (filePath) => {
    if (filePath.split('/').some((segment) => SKIPPED_DIRECTORIES.has(segment))) return;
    if (!extensions.some((extension) => filePath.endsWith(extension))) return;

    files.push(filePath);
  });

  return files;
};
