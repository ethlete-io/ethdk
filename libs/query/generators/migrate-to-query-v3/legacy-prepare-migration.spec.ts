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
    expect(result).not.toContain('destroyOnResponse');
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
import { computed, effect, inject, Injector } from '@angular/core';
import { createLegacyQueryCreator, queryComputed } from '@ethlete/query';
import { map, switchMap, tap } from 'rxjs';

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

    it('migrates a prepare call in an rxjs callback inside ngOnInit', async () => {
      writeComponent(`  source$ = {} as never;

  ngOnInit() {
    this.source$.pipe(switchMap(() => legacyGetUsers.prepare({ queryParams: { page: 1 } }).execute())).subscribe();
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('migrates a prepare call in a plain computed inside a method', async () => {
      writeComponent(`  build() {
    return computed(() => legacyGetUsers.prepare({ queryParams: { page: 1 } }).execute());
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('injector: this.injector');
    });

    it('turns a plain computed that returns the prepared query into a queryComputed', async () => {
      writeComponent(`  page = signal(1);
  users = computed(() => legacyGetUsers.prepare({ queryParams: { page: this.page() } }).execute());`);

      await migration(tree, { skipFormat: true });

      const result = readFile('component.ts');

      expect(result).toContain('queryComputed(() => legacyGetUsers.prepare(');
      expect(result).toContain('.execute(), { injector: this.injector })');
      expect(result).not.toContain(' computed(');
      expect(result).toMatch(/import \{[^}]*queryComputed[^}]*\} from '@ethlete\/query'/);
    });

    it('keeps the options of a plain computed that returns the prepared query', async () => {
      writeComponent(`  users = computed(() => legacyGetUsers.prepare({}).execute(), { equal: () => false });`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('queryComputed(() => legacyGetUsers.prepare(');
      expect(readFile('component.ts')).toContain('{ equal: () => false })');
    });

    it('leaves a plain computed alone when it only reads the query result', async () => {
      writeComponent(`  count = computed(() => legacyGetUsers.prepare({}).execute().rawState);`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain(' computed(');
    });

    it('adds destroyOnResponse to a prepare call in an async validator', async () => {
      writeComponent(`  control = new FormControl('', {
    asyncValidators: [(control: AbstractControl) => legacyGetUsers.prepare({ body: { name: control.value } }).execute().state$],
  });`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('destroyOnResponse: true');
    });

    it('adds no destroyOnResponse to a prepare call in an ordinary callback', async () => {
      writeComponent(`  config = {
    searchPreviewQueryFn: (term: string) => legacyGetUsers.prepare({ queryParams: { term } }).execute(),
  };`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).not.toContain('destroyOnResponse');
    });

    it('migrates a prepare call in a callback config function at a class field', async () => {
      writeComponent(`  config = {
    searchPreviewQueryFn: (term: string) => legacyGetUsers.prepare({ queryParams: { term } }).execute(),
  };`);

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

    it('migrates a container factory called from an rxjs callback in a setter', async () => {
      writeComponent(`  private injector = inject(Injector);

  set stage(value: number) {
    this.source$.pipe(tap(() => (this.users = legacyGetUsers.createSubject()))).subscribe();
  }

  users: unknown;
  source$ = {} as never;`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('legacyGetUsers.createSubject(null, { injector: this.injector })');
    });

    it('adds the injector to a container factory config and keeps the initial value', async () => {
      writeComponent(`  load() {
    return [legacyGetUsers.createSignal(first, { destroyOnResponse: true }), legacyGetUsers.behaviorSubject(first, cfg)];
  }`);

      await migration(tree, { skipFormat: true });

      const result = readFile('component.ts');

      expect(result).toContain(
        'legacyGetUsers.createSignal(first, { destroyOnResponse: true, injector: this.injector })',
      );
      expect(result).toContain('legacyGetUsers.behaviorSubject(first, { ...cfg, injector: this.injector })');
    });

    it('leaves a container factory that already passes an injector alone', async () => {
      writeComponent(`  load() {
    return legacyGetUsers.createSubject(null, { injector: someInjector });
  }`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('createSubject(null, { injector: someInjector })');
      expect(readFile('component.ts')).not.toContain('this.injector');
    });

    it('leaves a container factory at a class field alone', async () => {
      writeComponent(`  users = legacyGetUsers.createSubject();`);

      await migration(tree, { skipFormat: true });

      expect(readFile('component.ts')).toContain('users = legacyGetUsers.createSubject();');
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

  describe('destroyOnResponse for a query kept in a variable', () => {
    const migrateMethodBody = async (body: string) => {
      tree.write(
        'component.ts',
        `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  query = null as unknown;
  queries = [] as unknown[];

  load() {
    ${body}
  }
}
        `.trim(),
      );

      await migration(tree, { skipFormat: true });

      return readFile('component.ts');
    };

    it('adds it to a local variable executed once and never used otherwise', async () => {
      const result = await migrateMethodBody(
        'const query = legacyGetUsers.prepare({ id: 1 });\n    query.onSuccess(() => 1);\n    query.execute();',
      );

      expect(result).toContain('destroyOnResponse: true');
    });

    it('adds it to a local variable that holds the executed chain', async () => {
      const result = await migrateMethodBody('const query = legacyGetUsers.prepare({ id: 1 }).execute();');

      expect(result).toContain('destroyOnResponse: true');
    });

    it.each([
      [
        'a variable executed twice',
        'const query = legacyGetUsers.prepare({ id: 1 });\n    query.execute();\n    query.execute();',
      ],
      [
        'a variable returned',
        'const query = legacyGetUsers.prepare({ id: 1 });\n    query.execute();\n    return query;',
      ],
      [
        'a variable stored on the class',
        'const query = legacyGetUsers.prepare({ id: 1 });\n    this.query = query;\n    query.execute();',
      ],
      [
        'a variable pushed into a container',
        'const query = legacyGetUsers.prepare({ id: 1 });\n    this.queries.push(query);',
      ],
      ['a returned prepare call', 'return legacyGetUsers.prepare({ id: 1 });'],
      ['a prepare call assigned to a property', 'this.query = legacyGetUsers.prepare({ id: 1 });'],
    ])('does not add it to %s', async (_label, body) => {
      expect(await migrateMethodBody(body)).not.toContain('destroyOnResponse');
    });

    it('does not add it to a class property', async () => {
      tree.write(
        'component.ts',
        `
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent {
  users = legacyGetUsers.prepare({ id: 1 }).execute();
}
        `.trim(),
      );

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

  it('inserts the injector member before the leading comments of the first member', async () => {
    tree.write(
      'component.ts',
      `
import { Input } from '@angular/core';
import { createLegacyQueryCreator } from '@ethlete/query';

const getUsers = {} as never;
export const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers });

export class DemoComponent { // header
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('userId') id = 1;

  loadUsers() {
    return legacyGetUsers.prepare({ id: this.id });
  }
}
      `.trim(),
    );

    await migration(tree, { skipFormat: true });

    expect(readFile('component.ts')).toContain(
      "{ // header\n  private injector = inject(Injector);\n\n  // eslint-disable-next-line @angular-eslint/no-input-rename\n  @Input('userId') id = 1;",
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
    expect(result).toContain('config: { cacheAdapter, x: 1 }');
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
      expect(await migrateArgument('args')).toContain('legacyGetUsers.prepare({ ...args, injector: this.injector })');
    });

    it('keeps a spread and the properties next to it', async () => {
      expect(await migrateArgument('{ ...base, id }')).toContain('{ ...base, id, injector: this.injector }');
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
    expect(result).toContain('legacyGetUsers.prepare({ id: 3, injector: this.injector })');
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
    expect(report).toContain('add `const injector = inject(Injector);` at the top of the factory');
    expect(report).toContain('provideLegacyPrepareFallback()');
  });
});
