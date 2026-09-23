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

  it('should migrate a prepare call in an anonymous default-exported class', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export default class {
  loadUsers() {
    return legacyGetUsers.prepare();
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('private injector = inject(Injector);');
    expect(result).toContain('legacyGetUsers.prepare({ injector: this.injector');
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

  describe('callback call sites', () => {
    const writeComponent = (body: string) =>
      tree.write(
        'component.ts',
        `
import { computed, effect } from '@angular/core';
import { createLegacyQueryCreator, queryComputed } from '@ethlete/query';
import { map, switchMap } from 'rxjs';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
${body}
}
      `.trim(),
      );

    it('migrates a computed at a class field', async () => {
      writeComponent(`  users = computed(() => legacyGetUsers.prepare({ queryParams: { page: 1 } }));`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates an effect inside the constructor', async () => {
      writeComponent(`  constructor() {
    effect(() => legacyGetUsers.prepare({}));
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates an rxjs operator callback inside the constructor', async () => {
      writeComponent(`  constructor() {
    this.source$.pipe(map(() => legacyGetUsers.prepare({}))).subscribe();
  }

  private source$ = {} as never;`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates a callback nested inside queryComputed', async () => {
      writeComponent(`  users = queryComputed(() => this.source$.pipe(switchMap(() => legacyGetUsers.prepare({}))));

  private source$ = {} as never;`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('leaves queryComputed itself alone', async () => {
      writeComponent(`  users = queryComputed(() => legacyGetUsers.prepare({}));`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });

    it('leaves a synchronous array callback in the constructor alone', async () => {
      writeComponent(`  constructor() {
    [1, 2].forEach(() => legacyGetUsers.prepare({}));
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });

    it('leaves a plain class field alone', async () => {
      writeComponent(`  users = legacyGetUsers.prepare({});`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('injector');
    });
  });

  describe('destroyOnResponse for discarded queries', () => {
    const writeComponent = (statement: string) =>
      tree.write(
        'component.ts',
        `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    ${statement}
  }
}
      `.trim(),
      );

    it('adds it when the query is thrown away', async () => {
      writeComponent('legacyGetUsers.prepare({}).execute();');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('destroyOnResponse: true');
    });

    it('does not add it to a chained poll', async () => {
      writeComponent('legacyGetUsers.prepare({}).poll({ interval: 1000 });');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('destroyOnResponse');
    });

    it('does not add it when the query is handed to something else', async () => {
      writeComponent('this.container.next(legacyGetUsers.prepare({}));');

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('destroyOnResponse');
    });
  });

  it('does not add destroyOnResponse to a query a later method polls through this', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  private users = null;

  loadUsers() {
    const users = legacyGetUsers.prepare({ id: 1 });
    this.users = users;
  }

  startPolling() {
    this.users.poll({ interval: 1000 });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).not.toContain('destroyOnResponse');
  });

  it('does not add destroyOnResponse to a query a template polls', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    const users = legacyGetUsers.prepare({ id: 1 });

    return users;
  }
}
      `.trim(),
    );
    tree.write(
      'component.html',
      '<button (click)="users.poll()"></button><button (click)="users.stopPolling()"></button>',
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).not.toContain('destroyOnResponse');
  });

  it('inserts the injector member on its own line, keeping the next member indented', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    return legacyGetUsers.prepare({ id: 1 });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).toContain(
      'export class DemoComponent {\n  private injector = inject(Injector);\n\n  loadUsers() {',
    );
  });

  it('reuses an existing injector member under its own name', async () => {
    tree.write(
      'component.ts',
      `
import { Injector, inject } from '@angular/core';
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  private myInjector = inject(Injector);

  loadUsers() {
    return legacyGetUsers.prepare({ config: { cacheAdapter, x: 1 } });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('injector: this.myInjector');
    expect(result).not.toContain('private injector');
    expect(result).toContain('config: {\n    cacheAdapter,\n    x: 1,\n    destroyOnResponse: true\n  }');
  });

  it('treats getters and setters as methods', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  get users() {
    return legacyGetUsers.prepare({ id: 1 });
  }

  set users(value: unknown) {
    legacyGetUsers.prepare({ id: 2 }).execute();
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('legacyGetUsers.prepare({ id: 1, injector: this.injector })');
    expect(result).toContain('id: 2,\n  injector: this.injector,\n  config: { destroyOnResponse: true }');
  });

  it('leaves calls inside runInInjectionContext and runInContext alone', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    runInInjectionContext(this.env, () => legacyGetUsers.prepare({}));
    this.env.runInContext(() => legacyGetUsers.prepare({}));
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).not.toContain('injector');
  });

  describe('argument shapes', () => {
    const migrateArgument = async (argument: string) => {
      tree.write(
        'component.ts',
        `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  loadUsers() {
    const query = legacyGetUsers.prepare(${argument});

    return query;
  }
}
        `.trim(),
      );

      await migration(tree, { skipFormat: true });

      return readFile('component.ts');
    };

    it('spreads an argument that is not an object literal', async () => {
      expect(await migrateArgument('args')).toContain(
        'legacyGetUsers.prepare({ ...args, injector: this.injector, config: { destroyOnResponse: true } })',
      );
    });

    it('keeps a spread and the properties next to it', async () => {
      expect(await migrateArgument('{ ...base, id }')).toContain(
        '{\n  ...base,\n  id,\n  injector: this.injector,\n  config: { destroyOnResponse: true }\n}',
      );
    });

    it('keeps a config that is not an object literal as it is', async () => {
      expect(await migrateArgument('{ config: sharedConfig }')).toContain(
        'legacyGetUsers.prepare({ injector: this.injector, config: sharedConfig })',
      );
    });
  });

  describe('standalone functions', () => {
    const writeStandalone = (body: string) =>
      tree.write(
        'standalone.ts',
        `
import { inject } from '@angular/core';
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

${body}
        `.trim(),
      );

    it('declares an injector at the top of the enclosing function that calls inject', async () => {
      writeStandalone(`export const injectUsersLoader = () => {
  const http = inject(HttpClient);

  return () => legacyGetUsers.prepare({ id: 1 });
};`);

      await migration(tree, { skipFormat: true });

      const result = readFile('standalone.ts');

      expect(result).toContain("import { Injector, inject } from '@angular/core';");
      expect(result).toContain(
        'export const injectUsersLoader = () => {\n  const injector = inject(Injector);\n  const http = inject(HttpClient);',
      );
      expect(result).toContain('injector: injector');
      expect(readFile('query-v3-migration-tasks.md')).not.toContain('Review standalone prepare() usage');
    });

    it('declares one injector for several calls in the same function', async () => {
      writeStandalone(`export function injectLoaders() {
  inject(HttpClient);

  return [() => legacyGetUsers.prepare({ id: 1 }), () => legacyGetUsers.prepare({ id: 2 })];
}`);

      await migration(tree, { skipFormat: true });

      const result = readFile('standalone.ts');

      expect(result.match(/const injector = inject\(Injector\)/g)).toHaveLength(1);
      expect(result.match(/injector: injector/g)).toHaveLength(2);
    });

    it('reuses an injector parameter instead of declaring one', async () => {
      writeStandalone(`export function injectUsersLoader(parentInjector: Injector) {
  inject(HttpClient);

  return () => legacyGetUsers.prepare({ id: 1 });
}`);

      await migration(tree, { skipFormat: true });

      const result = readFile('standalone.ts');

      expect(result).toContain('injector: parentInjector');
      expect(result).not.toContain('const injector');
    });
  });

  it('only rewrites the legacy calls that need an injector in a mixed class', async () => {
    tree.write(
      'component.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  users = legacyGetUsers.prepare({ id: 1 });

  loadUsers() {
    this.form.prepare({ id: 2 });

    return legacyGetUsers.prepare({ id: 3 });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    const result = readFile('component.ts');

    expect(result).toContain('users = legacyGetUsers.prepare({ id: 1 });');
    expect(result).toContain('this.form.prepare({ id: 2 });');
    expect(result).toContain('id: 3,\n  injector: this.injector');
  });

  it('asks for a manual review of a call at module level', async () => {
    tree.write(
      'module-level.ts',
      `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

legacyGetUsers.prepare({ id: 1 });
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('query-v3-migration-tasks.md')).toContain('Verify execution context for legacyGetUsers');
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
