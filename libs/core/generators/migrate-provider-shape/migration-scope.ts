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
 * Limits the migration to a set of projects or paths. Unlike the query v3 migration there is no
 * cross-file coupling here - every provider declaration is rewritten on its own - so any scope is safe;
 * this exists to keep the diff reviewable.
 */
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

  const uniqueRoots = [...new Set(roots)].filter(
    (root) =>
      !roots.some((candidate) => candidate !== root && (root === candidate || root.startsWith(`${candidate}/`))),
  );

  return {
    visit: (targetTree, callback) => {
      for (const root of uniqueRoots) {
        visitNotIgnoredFiles(targetTree, root, callback);
      }
    },
    describe: () => uniqueRoots.join(', '),
  };
};
