import { Tree, getProjects, visitNotIgnoredFiles } from '@nx/devkit';

export type MigrationScopeOptions = {
  /** Nx project names to migrate. Empty / undefined means the whole workspace. */
  projects?: string[];

  /** Workspace-root-relative path prefixes to migrate. Unioned with `projects`. */
  include?: string[];
};

export type MigrationScope = {
  /** Visits every non-ignored file inside the scope. */
  visit: (tree: Tree, callback: (filePath: string) => void) => void;

  /** Whether a file is inside the scope. */
  includes: (filePath: string) => boolean;

  /** Human readable description of what is being migrated, for the console summary. */
  describe: () => string;
};

const stripTrailingSlash = (value: string) => (value.endsWith('/') ? value.slice(0, -1) : value);

/**
 * Limits the migration to a set of projects or paths.
 *
 * Rewriting every app in a monorepo in one run is rarely how adoption actually goes, and a 300-file
 * diff is not reviewable. Note the one coupling that cannot be split: a query client and the
 * creators built on it have to be migrated together, because the creators are rewritten in terms of
 * the client's generated `xGet` / `xPostSecure` helpers.
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
      includes: () => true,
      describe: () => 'the whole workspace',
    };
  }

  const includes = (filePath: string) => roots.some((root) => filePath === root || filePath.startsWith(`${root}/`));

  return {
    visit: (targetTree, callback) => {
      for (const root of roots) {
        visitNotIgnoredFiles(targetTree, root, callback);
      }
    },
    includes,
    describe: () => roots.join(', '),
  };
};
