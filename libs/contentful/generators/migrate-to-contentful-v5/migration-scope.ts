import { getProjects, Tree, visitNotIgnoredFiles } from '@nx/devkit';

export type MigrationScopeOptions = {
  /** Nx project names to migrate. Empty / undefined means the whole workspace. */
  projects?: string[];

  /** Workspace-root-relative path prefixes to migrate. Unioned with `projects`. */
  include?: string[];
};

export type MigrationScope = {
  /** Visits every non-ignored file inside the scope. */
  visit: (tree: Tree, callback: (filePath: string) => void) => void;

  /** Human readable description of what is being migrated, for the console summary. */
  describe: () => string;
};

const stripTrailingSlash = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value);

/**
 * Limits the migration to a set of projects or paths. There is no cross-file coupling here — every
 * template and import is rewritten on its own — so any scope is safe; this exists to keep the diff
 * reviewable.
 */
export const createMigrationScope = (tree: Tree, options: MigrationScopeOptions): MigrationScope => {
  const roots = new Set<string>();

  for (const projectName of options.projects ?? []) {
    const project = getProjects(tree).get(projectName);

    if (!project) {
      throw new Error(
        `Unknown project "${projectName}". Pass names as they appear in \`nx show projects\`, or use --include with a path prefix.`,
      );
    }

    roots.add(stripTrailingSlash(project.root));
  }

  for (const includePath of options.include ?? []) {
    roots.add(stripTrailingSlash(includePath));
  }

  if (roots.size === 0) {
    return {
      visit: (targetTree, callback) => visitNotIgnoredFiles(targetTree, '', callback),
      describe: () => 'the whole workspace',
    };
  }

  return {
    visit: (targetTree, callback) => {
      const visited = new Set<string>();

      for (const root of roots) {
        visitNotIgnoredFiles(targetTree, root, (filePath) => {
          if (visited.has(filePath)) return;

          visited.add(filePath);
          callback(filePath);
        });
      }
    },
    describe: () => [...roots].join(', '),
  };
};
