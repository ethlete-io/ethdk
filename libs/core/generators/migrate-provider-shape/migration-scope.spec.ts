import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createMigrationScope } from './migration-scope';

describe('migrate-provider-shape -> migration scope', () => {
  let tree: Tree;

  const visited = (scope: ReturnType<typeof createMigrationScope>) => {
    const files: string[] = [];
    scope.visit(tree, (file) => file.endsWith('.ts') && files.push(file));
    return files.sort();
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app-a', { root: 'apps/app-a' });
    addProjectConfiguration(tree, 'app-b', { root: 'apps/app-b/' });
    tree.write('apps/app-a/src/a.ts', '');
    tree.write('apps/app-b/src/b.ts', '');
    tree.write('libs/shared/src/c.ts', '');
  });

  it('should cover the whole workspace when the scope is empty', () => {
    const scope = createMigrationScope(tree, {});
    const files = visited(scope);

    expect(scope.describe()).toBe('the whole workspace');
    expect(files).toEqual(
      expect.arrayContaining(['apps/app-a/src/a.ts', 'apps/app-b/src/b.ts', 'libs/shared/src/c.ts']),
    );
  });

  it('should treat empty lists like an empty scope', () => {
    expect(createMigrationScope(tree, { projects: [], include: [] }).describe()).toBe('the whole workspace');
  });

  it('should limit the scope to the named projects', () => {
    const scope = createMigrationScope(tree, { projects: ['app-a'] });

    expect(visited(scope)).toEqual(['apps/app-a/src/a.ts']);
    expect(scope.describe()).toBe('apps/app-a');
  });

  it('should limit the scope to include prefixes, ignoring a trailing slash', () => {
    const scope = createMigrationScope(tree, { include: ['libs/shared/'] });

    expect(visited(scope)).toEqual(['libs/shared/src/c.ts']);
    expect(scope.describe()).toBe('libs/shared');
  });

  it('should union projects and include prefixes', () => {
    const scope = createMigrationScope(tree, { projects: ['app-b'], include: ['libs/shared'] });

    expect(visited(scope)).toEqual(['apps/app-b/src/b.ts', 'libs/shared/src/c.ts']);
    expect(scope.describe()).toBe('apps/app-b, libs/shared');
  });

  it('should visit a file once when a root is nested inside another', () => {
    const scope = createMigrationScope(tree, { projects: ['app-a'], include: ['apps/app-a/src', 'apps/app-a'] });

    expect(visited(scope)).toEqual(['apps/app-a/src/a.ts']);
    expect(scope.describe()).toBe('apps/app-a');
  });

  it('should throw for an unknown project', () => {
    expect(() => createMigrationScope(tree, { projects: ['nope'] })).toThrow('Unknown project "nope"');
  });
});
