import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './migration';

describe('migrate-to-query-v3 prepare migration', () => {
  let tree: Tree;

  const readFile = (path: string) => tree.read(path, 'utf-8')!;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(console, 'log').mockImplementation(() => {
      // noop
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // noop
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add an injector member and wire it into class-based prepare calls', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    return legacyGetUsers.prepare({ queryParams: { page: 1 } });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain("import { Injector, inject } from '@angular/core';");
    expect(result).toContain('private injector = inject(Injector);');
    expect(result).toContain('injector: this.injector');
    expect(result).toContain('config: { destroyOnResponse: true }');
  });

  it('should avoid destroyOnResponse when polling is detected in the same function', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    const query = legacyGetUsers.prepare();
    query.poll();

    return query;
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('const query = legacyGetUsers.prepare({ injector: this.injector });');
    expect(result).not.toContain('destroyOnResponse');
  });

  it('should write manual review tasks for standalone functions without inject context', async () => {
    tree.write(
      'standalone.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export const loadUsers = () => legacyGetUsers.prepare({ queryParams: { page: 1 } });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const report = readFile('query-v3-migration-tasks.md');

    expect(report).toContain('Review standalone prepare() usage for legacyGetUsers');
    expect(report).toContain('Pass an Injector explicitly');
  });
});
