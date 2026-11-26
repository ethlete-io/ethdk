import { getProjects, Tree, visitNotIgnoredFiles } from '@nx/devkit';

export type MigrationScopeOptions = {
  /** Nx project names to scan. Empty / undefined means the whole workspace. */
  projects?: string[];

  /** Workspace-root-relative path prefixes to scan. Unioned with `projects`. */
  include?: string[];
};

export type MigrationScope = {
  /** Visits every non-ignored file inside the scope. */
  visit: (tree: Tree, callback: (filePath: string) => void) => void;

  /** Human readable description of what is being scanned, for the console summary. */
  describe: () => string;
};

const stripTrailingSlash = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value);

export const createMigrationScope = (tree: Tree, options: MigrationScopeOptions): MigrationScope => {
  const roots: string[] = [];

  for (const projectName of options.projects ?? []) {
    const project = getProjects(tree).get(projectName);

    if (!project) {
      throw new Error(
        `Unknown project "${projectName}". Pass names as they appear in \`nx show projects\`, or use --include with a path prefix.`,
      );
    }

    roots.push(stripTrailingSlash(project.root));
  }

  for (const includePath of options.include ?? []) {
    roots.push(stripTrailingSlash(includePath));
  }

  if (roots.length === 0) {
    return {
      visit: (targetTree, callback) => visitNotIgnoredFiles(targetTree, '', callback),
      describe: () => 'the whole workspace',
    };
  }

  return {
    visit: (targetTree, callback) => {
      for (const root of roots) {
        visitNotIgnoredFiles(targetTree, root, callback);
      }
    },
    describe: () => roots.join(', '),
  };
};
